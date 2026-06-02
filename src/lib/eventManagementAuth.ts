import type {
  ChapterAccessMode,
  ChapterMembershipStatus,
  ChapterRole,
  EntityId,
  EventStaffRole,
  Role,
} from '@/types/event-management';
import type { PrismaClient } from '@prisma/client';

type HackerRecord = {
  id: EntityId;
  role?: Role | null;
};

type ChapterRecord = {
  id: EntityId;
  accessMode: ChapterAccessMode;
  status?: string | null;
};

type ChapterMembershipRecord = {
  id?: EntityId;
  chapterId: EntityId;
  hackerId: EntityId;
  role: ChapterRole;
  status: ChapterMembershipStatus;
};

type EventRecord = {
  id: EntityId;
  chapterId: EntityId;
};

type EventStaffRecord = {
  id?: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
  role: EventStaffRole;
};

type EventRegistrationRecord = {
  id?: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
};

export type EventManagementAuthPrisma = {
  hacker: PrismaClient['hacker'];
  chapter: PrismaClient['chapter'];
  chapterMembership: PrismaClient['chapterMembership'];
  event: PrismaClient['event'];
  eventStaff: PrismaClient['eventStaff'];
  eventRegistration: PrismaClient['eventRegistration'];
};

export type NullableHackerId = EntityId | null | undefined;

export type ChapterPermissionContext = {
  actor?: Pick<HackerRecord, 'role'> | null;
  chapter?: Pick<ChapterRecord, 'accessMode' | 'status'> | null;
  membership?: Pick<ChapterMembershipRecord, 'role' | 'status'> | null;
};

export type EventPermissionContext = {
  actor?: Pick<HackerRecord, 'role'> | null;
  chapterMembership?: Pick<ChapterMembershipRecord, 'role' | 'status'> | null;
  staff?: Pick<EventStaffRecord, 'role'> | null;
};

export type OrganizerNotePermissionContext = EventPermissionContext & {
  targetIsRelevantToChapter?: boolean;
  targetIsRelevantToEvent?: boolean;
};

export type OrganizerNoteScope = {
  chapterId?: EntityId | null;
  eventId?: EntityId | null;
};

export const SITE_ADMIN_ROLE: Role = 'SITE_ADMIN';
export const ACTIVE_MEMBERSHIP_STATUS: ChapterMembershipStatus = 'ACTIVE';
export const INVITED_MEMBERSHIP_STATUS: ChapterMembershipStatus = 'INVITED';
export const CHAPTER_ADMIN_ROLE: ChapterRole = 'ADMIN';
export const EVENT_MC_ROLE: EventStaffRole = 'MC';
export const EVENT_CO_MC_ROLE: EventStaffRole = 'CO_MC';

export function isSiteAdminRole(role: Role | null | undefined): boolean {
  return role === SITE_ADMIN_ROLE;
}

export function isSiteAdminActor(
  actor: Pick<HackerRecord, 'role'> | null | undefined
): boolean {
  return isSiteAdminRole(actor?.role);
}

export function isActiveChapterMembership(
  membership: Pick<ChapterMembershipRecord, 'status'> | null | undefined
): boolean {
  return membership?.status === ACTIVE_MEMBERSHIP_STATUS;
}

export function isInvitedChapterMembership(
  membership: Pick<ChapterMembershipRecord, 'status'> | null | undefined
): boolean {
  return membership?.status === INVITED_MEMBERSHIP_STATUS;
}

export function isChapterAdminMembership(
  membership:
    | Pick<ChapterMembershipRecord, 'role' | 'status'>
    | null
    | undefined
): boolean {
  return (
    membership?.role === CHAPTER_ADMIN_ROLE &&
    membership.status === ACTIVE_MEMBERSHIP_STATUS
  );
}

export function isChapterMemberMembership(
  membership: Pick<ChapterMembershipRecord, 'status'> | null | undefined
): boolean {
  return isActiveChapterMembership(membership);
}

export function isEventMcStaff(
  staff: Pick<EventStaffRecord, 'role'> | null | undefined
): boolean {
  return staff?.role === EVENT_MC_ROLE;
}

export function isEventCoMcStaff(
  staff: Pick<EventStaffRecord, 'role'> | null | undefined
): boolean {
  return staff?.role === EVENT_CO_MC_ROLE;
}

export function isEventPitchStaff(
  staff: Pick<EventStaffRecord, 'role'> | null | undefined
): boolean {
  return isEventMcStaff(staff) || isEventCoMcStaff(staff);
}

export function canViewChapterWithContext({
  actor,
  chapter,
  membership,
}: ChapterPermissionContext): boolean {
  if (!chapter) return false;
  if (isSiteAdminActor(actor)) return true;
  if (isChapterAdminMembership(membership)) return true;
  if (isActiveChapterMembership(membership)) return true;
  if (isInvitedChapterMembership(membership)) return true;

  return chapter.accessMode === 'PUBLIC' && chapter.status === 'ACTIVE';
}

export function canManageChapterSettingsWithContext({
  actor,
  membership,
}: ChapterPermissionContext): boolean {
  return isSiteAdminActor(actor) || isChapterAdminMembership(membership);
}

export function canManageChapterMembersWithContext(
  context: ChapterPermissionContext
): boolean {
  return canManageChapterSettingsWithContext(context);
}

export function canManageEventSettingsWithContext({
  actor,
  chapterMembership,
  staff,
}: EventPermissionContext): boolean {
  return (
    isSiteAdminActor(actor) ||
    isChapterAdminMembership(chapterMembership) ||
    isEventMcStaff(staff)
  );
}

export function canManagePitchWithContext({
  actor,
  chapterMembership,
  staff,
}: EventPermissionContext): boolean {
  return (
    isSiteAdminActor(actor) ||
    isChapterAdminMembership(chapterMembership) ||
    isEventPitchStaff(staff)
  );
}

export function canManageRegistrationsWithContext({
  actor,
  chapterMembership,
  staff,
}: EventPermissionContext): boolean {
  return (
    isSiteAdminActor(actor) ||
    isChapterAdminMembership(chapterMembership) ||
    isEventPitchStaff(staff)
  );
}

export function canDecideRegistrationsWithContext({
  actor,
  chapterMembership,
  staff,
}: EventPermissionContext): boolean {
  return (
    isSiteAdminActor(actor) ||
    isChapterAdminMembership(chapterMembership) ||
    isEventMcStaff(staff)
  );
}

export function canViewOrganizerNoteWithContext({
  actor,
  chapterMembership,
  staff,
  targetIsRelevantToChapter = false,
  targetIsRelevantToEvent = false,
}: OrganizerNotePermissionContext): boolean {
  if (isSiteAdminActor(actor)) return true;
  if (isChapterAdminMembership(chapterMembership)) {
    return targetIsRelevantToChapter || targetIsRelevantToEvent;
  }
  if (isEventPitchStaff(staff)) return targetIsRelevantToEvent;
  return false;
}

export function canEditOrganizerNoteWithContext(
  context: OrganizerNotePermissionContext
): boolean {
  return canViewOrganizerNoteWithContext(context);
}

export function canViewOrganizerNoteRevisionsWithContext({
  actor,
  chapterMembership,
  targetIsRelevantToChapter = false,
  targetIsRelevantToEvent = false,
}: OrganizerNotePermissionContext): boolean {
  if (isSiteAdminActor(actor)) return true;
  if (!isChapterAdminMembership(chapterMembership)) return false;
  return targetIsRelevantToChapter || targetIsRelevantToEvent;
}

export async function getHackerForPermissions(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId
): Promise<HackerRecord | null> {
  if (!hackerId) return null;

  return prisma.hacker.findUnique({
    where: { id: hackerId },
    select: { id: true, role: true },
  });
}

export async function isSiteAdmin(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId
): Promise<boolean> {
  const hacker = await getHackerForPermissions(prisma, hackerId);
  return isSiteAdminActor(hacker);
}

export async function getChapterMembershipForPermissions(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<ChapterMembershipRecord | null> {
  if (!hackerId) return null;

  return prisma.chapterMembership.findFirst({
    where: { chapterId, hackerId },
    select: {
      id: true,
      chapterId: true,
      hackerId: true,
      role: true,
      status: true,
    },
  });
}

export async function isChapterAdmin(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<boolean> {
  const membership = await getChapterMembershipForPermissions(
    prisma,
    hackerId,
    chapterId
  );

  return isChapterAdminMembership(membership);
}

export async function isChapterMember(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<boolean> {
  const membership = await getChapterMembershipForPermissions(
    prisma,
    hackerId,
    chapterId
  );

  return isChapterMemberMembership(membership);
}

export async function canViewChapter(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<boolean> {
  const [actor, chapter, membership] = await Promise.all([
    getHackerForPermissions(prisma, hackerId),
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, accessMode: true, status: true },
    }),
    getChapterMembershipForPermissions(prisma, hackerId, chapterId),
  ]);

  return canViewChapterWithContext({ actor, chapter, membership });
}

export async function canManageChapterSettings(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<boolean> {
  const [actor, membership] = await Promise.all([
    getHackerForPermissions(prisma, hackerId),
    getChapterMembershipForPermissions(prisma, hackerId, chapterId),
  ]);

  return canManageChapterSettingsWithContext({ actor, membership });
}

export async function canManageChapterMembers(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  chapterId: EntityId
): Promise<boolean> {
  const [actor, membership] = await Promise.all([
    getHackerForPermissions(prisma, hackerId),
    getChapterMembershipForPermissions(prisma, hackerId, chapterId),
  ]);

  return canManageChapterMembersWithContext({ actor, membership });
}

export async function getEventForPermissions(
  prisma: EventManagementAuthPrisma,
  eventId: EntityId
): Promise<EventRecord | null> {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, chapterId: true },
  });
}

export async function getEventStaffForPermissions(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<EventStaffRecord | null> {
  if (!hackerId) return null;

  return prisma.eventStaff.findFirst({
    where: {
      eventId,
      hackerId,
      role: { in: [EVENT_MC_ROLE, EVENT_CO_MC_ROLE] },
    },
    select: {
      id: true,
      eventId: true,
      hackerId: true,
      role: true,
    },
  });
}

async function getEventPermissionContext(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<EventPermissionContext | null> {
  const [actor, event, staff] = await Promise.all([
    getHackerForPermissions(prisma, hackerId),
    getEventForPermissions(prisma, eventId),
    getEventStaffForPermissions(prisma, hackerId, eventId),
  ]);

  if (!event) return null;

  const chapterMembership = await getChapterMembershipForPermissions(
    prisma,
    hackerId,
    event.chapterId
  );

  return { actor, chapterMembership, staff };
}

export async function canManageEventSettings(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<boolean> {
  const context = await getEventPermissionContext(prisma, hackerId, eventId);
  return context ? canManageEventSettingsWithContext(context) : false;
}

export async function canManagePitch(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<boolean> {
  const context = await getEventPermissionContext(prisma, hackerId, eventId);
  return context ? canManagePitchWithContext(context) : false;
}

export async function canManageRegistrations(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<boolean> {
  const context = await getEventPermissionContext(prisma, hackerId, eventId);
  return context ? canManageRegistrationsWithContext(context) : false;
}

export async function canDecideRegistrations(
  prisma: EventManagementAuthPrisma,
  hackerId: NullableHackerId,
  eventId: EntityId
): Promise<boolean> {
  const context = await getEventPermissionContext(prisma, hackerId, eventId);
  return context ? canDecideRegistrationsWithContext(context) : false;
}

export async function hasEventRegistrationForPermissions(
  prisma: EventManagementAuthPrisma,
  hackerId: EntityId,
  eventId: EntityId
): Promise<boolean> {
  const registration = await prisma.eventRegistration.findFirst({
    where: { eventId, hackerId },
    select: { id: true, eventId: true, hackerId: true },
  });

  return Boolean(registration);
}

export async function hasChapterOrganizerNoteRelevance(
  prisma: EventManagementAuthPrisma,
  targetHackerId: EntityId,
  chapterId: EntityId
): Promise<boolean> {
  const [membership, registration] = await Promise.all([
    prisma.chapterMembership.findFirst({
      where: {
        chapterId,
        hackerId: targetHackerId,
        status: { in: [ACTIVE_MEMBERSHIP_STATUS, INVITED_MEMBERSHIP_STATUS] },
      },
      select: {
        id: true,
        chapterId: true,
        hackerId: true,
        role: true,
        status: true,
      },
    }),
    prisma.eventRegistration.findFirst({
      where: {
        hackerId: targetHackerId,
        event: { chapterId },
      },
      select: { id: true, eventId: true, hackerId: true },
    }),
  ]);

  return Boolean(membership || registration);
}

async function getOrganizerNotePermissionContext(
  prisma: EventManagementAuthPrisma,
  viewerHackerId: NullableHackerId,
  targetHackerId: EntityId,
  scope: OrganizerNoteScope = {}
): Promise<OrganizerNotePermissionContext> {
  const [actor, event, staff] = await Promise.all([
    getHackerForPermissions(prisma, viewerHackerId),
    scope.eventId ? getEventForPermissions(prisma, scope.eventId) : null,
    scope.eventId
      ? getEventStaffForPermissions(prisma, viewerHackerId, scope.eventId)
      : null,
  ]);

  const chapterId = scope.chapterId ?? event?.chapterId ?? null;
  const [
    chapterMembership,
    targetIsRelevantToChapter,
    targetIsRelevantToEvent,
  ] = await Promise.all([
    chapterId
      ? getChapterMembershipForPermissions(prisma, viewerHackerId, chapterId)
      : null,
    chapterId
      ? hasChapterOrganizerNoteRelevance(prisma, targetHackerId, chapterId)
      : false,
    scope.eventId
      ? hasEventRegistrationForPermissions(
          prisma,
          targetHackerId,
          scope.eventId
        )
      : false,
  ]);

  return {
    actor,
    chapterMembership,
    staff,
    targetIsRelevantToChapter,
    targetIsRelevantToEvent,
  };
}

export async function canViewOrganizerNote(
  prisma: EventManagementAuthPrisma,
  viewerHackerId: NullableHackerId,
  targetHackerId: EntityId,
  scope: OrganizerNoteScope = {}
): Promise<boolean> {
  const context = await getOrganizerNotePermissionContext(
    prisma,
    viewerHackerId,
    targetHackerId,
    scope
  );

  return canViewOrganizerNoteWithContext(context);
}

export async function canEditOrganizerNote(
  prisma: EventManagementAuthPrisma,
  viewerHackerId: NullableHackerId,
  targetHackerId: EntityId,
  scope: OrganizerNoteScope = {}
): Promise<boolean> {
  const context = await getOrganizerNotePermissionContext(
    prisma,
    viewerHackerId,
    targetHackerId,
    scope
  );

  return canEditOrganizerNoteWithContext(context);
}

export async function canViewOrganizerNoteRevisions(
  prisma: EventManagementAuthPrisma,
  viewerHackerId: NullableHackerId,
  targetHackerId: EntityId,
  scope: OrganizerNoteScope = {}
): Promise<boolean> {
  const context = await getOrganizerNotePermissionContext(
    prisma,
    viewerHackerId,
    targetHackerId,
    scope
  );

  return canViewOrganizerNoteRevisionsWithContext(context);
}
