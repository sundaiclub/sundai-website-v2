import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  canAccessEventWorkspaceWithContext,
  canAdministerEventWithContext,
  canManageEventCommunicationsWithContext,
  canManageEventMaterialsWithContext,
  canManageEventNotesWithContext,
  canManageEventOperationsWithContext,
  canManageEventPitchWithContext,
  canManagePitchWithContext,
  canManageChapterMembers,
  canManageChapterSettings,
  canManageEventSettings,
  getChapterMembershipForPermissions,
} from '@/lib/eventManagementAuth';
import type { EventPermissionContext } from '@/lib/eventManagementAuth';

type EventCapabilityCheck = (context: EventPermissionContext) => boolean;

type EventPitchManagerEvent = Prisma.EventGetPayload<{
  include: { staff: { select: { hackerId: true; role: true } } };
}>;

type EventPitchManagerPitchSession = Prisma.PitchSessionGetPayload<{
  include: {
    projects: {
      orderBy: { position: 'asc' };
      include: {
        pitchVotes: {
          select: { hackerId: true; value: true; createdAt: true };
        };
        project: {
          include: {
            thumbnail: true;
            launchLead: { include: { avatar: true } };
            participants: {
              include: { hacker: { include: { avatar: true } } };
            };
            techTags: true;
            domainTags: true;
            likes: { select: { hackerId: true; createdAt: true } };
          };
        };
      };
    };
  };
}>;

export async function getCurrentHacker() {
  const { userId } = auth();
  if (!userId) return null;

  return prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true, name: true, email: true },
  });
}

export function unauthorized() {
  return new NextResponse('Unauthorized', { status: 401 });
}

export function forbidden() {
  return new NextResponse('Forbidden', { status: 403 });
}

export function notFound() {
  return new NextResponse('Not Found', { status: 404 });
}

function userNotFound() {
  return new NextResponse('User not found', { status: 404 });
}

function eventNotFound() {
  return new NextResponse('Event not found', { status: 404 });
}

function pitchSessionNotFound() {
  return new NextResponse('Pitch session not found', { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function isSiteAdmin(
  hacker: Awaited<ReturnType<typeof getCurrentHacker>>
) {
  return hacker?.role === 'SITE_ADMIN';
}

export async function requireSiteAdmin() {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };
  if (!isSiteAdmin(hacker)) return { hacker, response: forbidden() };
  return { hacker, response: null };
}

export async function requireChapterManager(chapterId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };

  const allowed = await canManageChapterSettings(prisma, hacker.id, chapterId);
  if (!allowed) return { hacker, response: forbidden() };

  return { hacker, response: null };
}

export async function requireChapterMemberManager(chapterId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };

  const allowed = await canManageChapterMembers(prisma, hacker.id, chapterId);
  if (!allowed) return { hacker, response: forbidden() };

  return { hacker, response: null };
}

export async function requireEventSettingsManager(eventId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, event: null, response: unauthorized() };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!event) return { hacker, event: null, response: notFound() };

  const allowed = await canManageEventSettings(prisma, hacker.id, eventId);
  if (!allowed) return { hacker, event, response: forbidden() };

  return { hacker, event, response: null };
}

async function requireCurrentEventCapability(
  eventId: string,
  canAccess: EventCapabilityCheck
) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, event: null, response: unauthorized() };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      staff: {
        where: { hackerId: hacker.id },
        select: { role: true },
      },
    },
  });
  if (!event) return { hacker, event: null, response: notFound() };

  const chapterMembership = await getChapterMembershipForPermissions(
    prisma,
    hacker.id,
    event.chapterId
  );
  const staff = event.staff?.[0] ?? null;

  if (!canAccess({ actor: hacker, chapterMembership, staff })) {
    return { hacker, event: null, response: forbidden() };
  }

  return { hacker, event, response: null };
}

export function requireEventWorkspaceAccess(eventId: string) {
  return requireCurrentEventCapability(
    eventId,
    canAccessEventWorkspaceWithContext
  );
}

export function requireEventAdministrator(eventId: string) {
  return requireCurrentEventCapability(eventId, canAdministerEventWithContext);
}

export function requireEventOperationsManager(eventId: string) {
  return requireCurrentEventCapability(
    eventId,
    canManageEventOperationsWithContext
  );
}

export function requireEventCommunicationsManager(eventId: string) {
  return requireCurrentEventCapability(
    eventId,
    canManageEventCommunicationsWithContext
  );
}

export function requireEventMaterialsManager(eventId: string) {
  return requireCurrentEventCapability(
    eventId,
    canManageEventMaterialsWithContext
  );
}

export function requireEventNotesManager(eventId: string) {
  return requireCurrentEventCapability(eventId, canManageEventNotesWithContext);
}

export function requireEventPitchAccess(eventId: string) {
  return requireCurrentEventCapability(eventId, canManageEventPitchWithContext);
}

export async function requireEventPitchManager(eventId: string) {
  const { userId } = auth();
  if (!userId) {
    return { hacker: null, event: null, response: unauthorized() };
  }

  const hacker = await prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true },
  });
  if (!hacker) {
    return { hacker: null, event: null, response: userNotFound() };
  }

  const event = (await prisma.event.findUnique({
    where: { id: eventId },
    include: { staff: { select: { hackerId: true, role: true } } },
  })) as EventPitchManagerEvent | null;
  if (!event) {
    return { hacker, event: null, response: eventNotFound() };
  }

  const chapterMembership = await getChapterMembershipForPermissions(
    prisma,
    hacker.id,
    event.chapterId
  );
  const staff =
    event.staff.find(staffMember => staffMember.hackerId === hacker.id) ?? null;

  const allowed = canManagePitchWithContext({
    actor: hacker,
    chapterMembership,
    staff,
  });

  if (!allowed) {
    return { hacker, event, response: unauthorized() };
  }

  const pitchSession = (await prisma.pitchSession.findFirst({
    where: { eventId },
    include: {
      projects: {
        orderBy: { position: 'asc' },
        include: {
          pitchVotes: {
            select: { hackerId: true, value: true, createdAt: true },
          },
          project: {
            include: {
              thumbnail: true,
              launchLead: { include: { avatar: true } },
              participants: {
                include: { hacker: { include: { avatar: true } } },
              },
              techTags: true,
              domainTags: true,
              likes: { select: { hackerId: true, createdAt: true } },
            },
          },
        },
      },
    },
  })) as EventPitchManagerPitchSession | null;
  if (!pitchSession) {
    return {
      hacker,
      event,
      pitchSession: null,
      response: pitchSessionNotFound(),
    };
  }

  return { hacker, event, pitchSession, response: null };
}
