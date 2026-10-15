import type { Hacker, Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { isSiteAdminActor } from '@/lib/eventManagementAuth';
import { PUBLIC_APP_URL } from '@/lib/siteUrl';
import type {
  EventCheckInList,
  EventCheckInRow,
  WorkspaceCheckInCounts,
} from '@/types/event-workspace';

// Check-in stays open until a full day after the event finishes.
export const CHECK_IN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
export const CHECK_IN_ORGANIZERS_ONLY_NOTICE = 'check-in-organizers-only';
const MAX_CHECK_IN_ROWS = 50;

const CHECK_IN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CheckInActor = Pick<Hacker, 'id' | 'role'>;

export type CheckInFailureReason =
  | 'NOT_FOUND'
  | 'TRACKING_DISABLED'
  | 'EVENT_ENDED'
  | 'NOT_APPROVED'
  | 'ALREADY_CHECKED_IN';

export type CheckInResult =
  | {
      ok: true;
      registration: { id: string; checkedInAt: Date; checkedInById: string };
    }
  | {
      ok: false;
      reason: CheckInFailureReason;
      checkedInAt?: Date | null;
    };

function normalizeAppUrl(appUrl: string) {
  return appUrl.replace(/\/+$/, '');
}

export function isCheckInToken(value: string): boolean {
  return CHECK_IN_TOKEN_PATTERN.test(value);
}

export function checkInUrl(token: string, appUrl = PUBLIC_APP_URL): string {
  return `${normalizeAppUrl(appUrl)}/check-in/${encodeURIComponent(token)}`;
}

export function checkInQrImageUrl(
  token: string,
  appUrl = PUBLIC_APP_URL
): string {
  return `${normalizeAppUrl(appUrl)}/api/qr/check-in/${encodeURIComponent(token)}`;
}

export function eventTicketUrl(
  event: { slug: string; chapter: { slug: string } },
  appUrl = PUBLIC_APP_URL
): string {
  return `${normalizeAppUrl(appUrl)}/events/${encodeURIComponent(
    event.chapter.slug
  )}/${encodeURIComponent(event.slug)}?tab=ticket`;
}

export function renderCheckInQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(checkInUrl(token), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export function hasCheckInWindowEnded(
  event: { startTime: Date; endTime: Date | null },
  now = new Date()
): boolean {
  const finishedAt = event.endTime ?? event.startTime;
  return now.getTime() > finishedAt.getTime() + CHECK_IN_GRACE_PERIOD_MS;
}

function visibleRegistrationWhere(
  eventId: string,
  actor: CheckInActor
): Prisma.EventRegistrationWhereInput {
  return {
    eventId,
    status: 'APPROVED',
    cancelledAt: null,
    ...(!isSiteAdminActor(actor) && {
      hacker: { userBans: { none: { revokedAt: null } } },
    }),
  };
}

export async function countEventCheckIns(
  eventId: string,
  actor: CheckInActor
): Promise<WorkspaceCheckInCounts> {
  const where = visibleRegistrationWhere(eventId, actor);
  const [approved, checkedIn] = await prisma.$transaction([
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.count({
      where: { ...where, checkedInAt: { not: null } },
    }),
  ]);
  return { approved, checkedIn };
}

export async function listEventCheckIns(input: {
  eventId: string;
  actor: CheckInActor;
  search?: string | null;
}): Promise<Omit<EventCheckInList, 'trackAttendance'>> {
  const search = input.search?.trim();
  const where: Prisma.EventRegistrationWhereInput = {
    ...visibleRegistrationWhere(input.eventId, input.actor),
    ...(search && {
      OR: [
        { hacker: { name: { contains: search, mode: 'insensitive' } } },
        { hacker: { email: { contains: search, mode: 'insensitive' } } },
        { hacker: { username: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [counts, registrations] = await Promise.all([
    countEventCheckIns(input.eventId, input.actor),
    prisma.eventRegistration.findMany({
      where,
      orderBy: [{ hacker: { name: 'asc' } }, { id: 'asc' }],
      take: MAX_CHECK_IN_ROWS + 1,
      select: {
        id: true,
        hackerId: true,
        checkedInAt: true,
        checkedInBy: { select: { name: true } },
        hacker: { select: { name: true, username: true, email: true } },
      },
    }),
  ]);

  return {
    counts,
    hasMore: registrations.length > MAX_CHECK_IN_ROWS,
    rows: registrations.slice(0, MAX_CHECK_IN_ROWS).map(
      (registration): EventCheckInRow => ({
        registrationId: registration.id,
        hackerId: registration.hackerId,
        name: registration.hacker.name,
        username: registration.hacker.username,
        email: registration.hacker.email,
        checkedInAt: registration.checkedInAt?.toISOString() ?? null,
        checkedInBy: registration.checkedInBy?.name ?? null,
      })
    ),
  };
}

export async function checkInEventRegistration(input: {
  eventId: string;
  registrationId: string;
  actorId: string;
  now?: Date;
}): Promise<CheckInResult> {
  const now = input.now ?? new Date();
  const registration = await prisma.eventRegistration.findFirst({
    where: { id: input.registrationId, eventId: input.eventId },
    select: {
      id: true,
      status: true,
      cancelledAt: true,
      checkedInAt: true,
      event: {
        select: { trackAttendance: true, startTime: true, endTime: true },
      },
    },
  });

  if (!registration) return { ok: false, reason: 'NOT_FOUND' };
  if (!registration.event.trackAttendance) {
    return { ok: false, reason: 'TRACKING_DISABLED' };
  }
  if (hasCheckInWindowEnded(registration.event, now)) {
    return { ok: false, reason: 'EVENT_ENDED' };
  }
  if (registration.status !== 'APPROVED' || registration.cancelledAt) {
    return { ok: false, reason: 'NOT_APPROVED' };
  }
  if (registration.checkedInAt) {
    return {
      ok: false,
      reason: 'ALREADY_CHECKED_IN',
      checkedInAt: registration.checkedInAt,
    };
  }

  // Guard on checkedInAt so two simultaneous scans record one check-in.
  const checkedIn = await prisma.$transaction(async tx => {
    const update = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        status: 'APPROVED',
        cancelledAt: null,
        checkedInAt: null,
      },
      data: { checkedInAt: now, checkedInById: input.actorId },
    });
    if (update.count === 0) return false;

    await tx.eventRegistrationAudit.create({
      data: {
        registrationId: registration.id,
        eventId: input.eventId,
        actorId: input.actorId,
        fromStatus: 'APPROVED',
        toStatus: 'APPROVED',
        changeJson: { action: 'CHECK_IN', checkedInAt: now.toISOString() },
      },
    });
    return true;
  });

  if (!checkedIn) {
    const current = await prisma.eventRegistration.findUnique({
      where: { id: registration.id },
      select: { checkedInAt: true },
    });
    return current?.checkedInAt
      ? {
          ok: false,
          reason: 'ALREADY_CHECKED_IN',
          checkedInAt: current.checkedInAt,
        }
      : { ok: false, reason: 'NOT_APPROVED' };
  }

  return {
    ok: true,
    registration: {
      id: registration.id,
      checkedInAt: now,
      checkedInById: input.actorId,
    },
  };
}

export async function getViewerCheckInTicket(input: {
  eventId: string;
  clerkId: string | null;
}) {
  if (!input.clerkId) return null;

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: input.eventId,
      hacker: { clerkId: input.clerkId },
      status: 'APPROVED',
      cancelledAt: null,
      event: { trackAttendance: true },
    },
    select: {
      checkInToken: true,
      checkedInAt: true,
      hacker: { select: { name: true } },
    },
  });

  return registration
    ? {
        token: registration.checkInToken,
        attendeeName: registration.hacker.name,
        checkedInAt: registration.checkedInAt,
      }
    : null;
}

export function loadRegistrationByCheckInToken(token: string) {
  if (!isCheckInToken(token)) return Promise.resolve(null);

  return prisma.eventRegistration.findUnique({
    where: { checkInToken: token },
    select: {
      id: true,
      eventId: true,
      status: true,
      cancelledAt: true,
      answersJson: true,
      templateSnapshotJson: true,
      submittedAt: true,
      checkedInAt: true,
      checkedInBy: { select: { name: true } },
      hacker: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: { select: { url: true } },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          timezone: true,
          startTime: true,
          endTime: true,
          trackAttendance: true,
          chapter: { select: { slug: true, name: true } },
        },
      },
    },
  });
}
