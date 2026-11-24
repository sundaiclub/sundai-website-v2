import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  EMPTY_APPLICANT_HISTORY,
  getApplicantHistory,
} from '@/lib/applicantHistory';
import { parseTemplateFieldsJson } from '@/lib/applicationTemplates';
import type {
  ApplicantHistory,
  EntityId,
  JsonObject,
  JsonValue,
  OrganizerRegistrationReviewCapabilities,
  OrganizerRegistrationReviewRow,
  RegistrationReviewOrder,
  RegistrationStatus,
  TemplateFieldDefinition,
} from '@/types/event-management';

export const REVIEW_QUEUE_PAGE_SIZE = 50;
export const REVIEW_QUEUE_MAX_PAGE_SIZE = 100;

type ReviewQueuePrismaClient = Pick<
  PrismaClient,
  'event' | 'eventRegistration' | 'project'
>;

export type RegistrationReviewQueueInput = {
  eventId: EntityId;
  status: RegistrationStatus;
  hideBannedUsers: boolean;
  search?: string | null;
  order: RegistrationReviewOrder;
  take: number;
  skip: number;
  capabilities: OrganizerRegistrationReviewCapabilities;
};

export type RegistrationReviewQueuePage = {
  capacity: number | null;
  counts: Partial<Record<RegistrationStatus, number>>;
  rows: OrganizerRegistrationReviewRow[];
  hasMore: boolean;
};

const reviewRegistrationInclude = {
  hacker: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      organizerNote: { select: { body: true } },
      userBans: {
        where: { revokedAt: null },
        select: { id: true, publicSafeReason: true, createdAt: true },
        take: 1,
      },
    },
  },
  decidedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} satisfies Prisma.EventRegistrationInclude;

type ReviewRegistrationRecord = Prisma.EventRegistrationGetPayload<{
  include: typeof reviewRegistrationInclude;
}>;

// MCs and co-MCs get an approved registration when they are assigned as event
// staff. They never applied, so the review queue and its counts leave them out.
function registrationScopeWhere(
  eventId: EntityId,
  hideBannedUsers: boolean
): Prisma.EventRegistrationWhereInput {
  return {
    eventId,
    hacker: {
      eventStaffAssignments: { none: { eventId } },
      ...(hideBannedUsers && { userBans: { none: { revokedAt: null } } }),
    },
  };
}

function searchWhere(
  search: string | null | undefined
): Prisma.EventRegistrationWhereInput {
  const term = search?.trim();
  if (!term) return {};
  return {
    OR: [
      { hacker: { name: { contains: term, mode: 'insensitive' } } },
      { hacker: { email: { contains: term, mode: 'insensitive' } } },
      { hacker: { username: { contains: term, mode: 'insensitive' } } },
    ],
  };
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonValue)
  );
}

function templateFields(value: unknown): TemplateFieldDefinition[] | null {
  if (value === null || value === undefined) return null;
  try {
    return parseTemplateFieldsJson(value, 'registration.templateSnapshotJson');
  } catch {
    return null;
  }
}

function reviewRow(
  registration: ReviewRegistrationRecord,
  capabilities: OrganizerRegistrationReviewCapabilities,
  applicantHistory: ApplicantHistory
): OrganizerRegistrationReviewRow {
  const answers = isJsonObject(registration.answersJson)
    ? registration.answersJson
    : null;

  return {
    id: registration.id,
    eventId: registration.eventId,
    hackerId: registration.hackerId,
    status: registration.status,
    source: registration.source,
    applicant: {
      id: registration.hacker.id,
      name: registration.hacker.name,
      username: registration.hacker.username ?? null,
      email: registration.hacker.email,
      role: registration.hacker.role,
    },
    applicantHistory,
    answersJson: answers,
    templateSnapshotJson: templateFields(registration.templateSnapshotJson),
    publicSafeMessage: registration.publicSafeMessage ?? null,
    internalReviewNotes: registration.internalReviewNotes ?? null,
    organizerNoteBody: registration.hacker.organizerNote?.body ?? null,
    submittedAt: registration.submittedAt ?? null,
    decidedAt: registration.decidedAt ?? null,
    decidedBy: registration.decidedBy ?? null,
    cancelledAt: registration.cancelledAt ?? null,
    cancelledBy: registration.cancelledBy ?? null,
    activeBan: capabilities.canViewBanContext
      ? (registration.hacker.userBans[0] ?? null)
      : null,
    capabilities,
  };
}

/**
 * Loads one page of the organizer RSVP queue with per-status counts and the
 * event capacity. Callers must verify registration review access first.
 */
export async function loadRegistrationReviewQueue(
  input: RegistrationReviewQueueInput,
  db: ReviewQueuePrismaClient = prisma
): Promise<RegistrationReviewQueuePage> {
  const scope = registrationScopeWhere(input.eventId, input.hideBannedUsers);
  const direction = input.order === 'newest' ? 'desc' : 'asc';

  const rowsPromise = db.eventRegistration
    .findMany({
      where: {
        ...scope,
        status: input.status,
        ...searchWhere(input.search),
      },
      include: reviewRegistrationInclude,
      orderBy: [{ createdAt: direction }, { id: direction }],
      // One extra row tells the client whether another page exists.
      take: input.take + 1,
      skip: input.skip,
    })
    .then(async registrations => {
      const page = registrations.slice(0, input.take);
      const history = await getApplicantHistory(
        input.eventId,
        page.map(registration => registration.hackerId),
        db
      );
      return {
        hasMore: registrations.length > input.take,
        rows: page.map(registration =>
          reviewRow(
            registration,
            input.capabilities,
            history.get(registration.hackerId) ?? EMPTY_APPLICANT_HISTORY
          )
        ),
      };
    });

  const [{ rows, hasMore }, statusGroups, event] = await Promise.all([
    rowsPromise,
    db.eventRegistration.groupBy({
      by: ['status'],
      where: scope,
      orderBy: { status: 'asc' },
      _count: { _all: true },
    }),
    db.event.findUnique({
      where: { id: input.eventId },
      select: { capacity: true },
    }),
  ]);

  const counts: Partial<Record<RegistrationStatus, number>> = {};
  for (const group of statusGroups) {
    const aggregate = group._count as { _all?: number } | undefined;
    counts[group.status] = aggregate?._all ?? 0;
  }

  return { capacity: event?.capacity ?? null, counts, rows, hasMore };
}
