import prisma from './prisma';
import type {
  EntityId,
  EventStaffRole,
  HackerOrganizerNote,
  HackerOrganizerNoteRevision,
  OrganizerNoteAccess,
  Role,
} from '@/types/event-management';
import { isSiteAdminRole } from '@/lib/eventManagementAuth';

type HackerRecord = {
  id: EntityId;
  role?: Role | null;
};

type ChapterMembershipRecord = {
  chapterId: EntityId;
};

type EventStaffRecord = {
  eventId: EntityId;
  role: EventStaffRole;
  event?: {
    chapterId?: EntityId | null;
  } | null;
};

type EventRegistrationRecord = {
  eventId: EntityId;
  event?: {
    chapterId?: EntityId | null;
  } | null;
};

type Delegate<TRecord> = {
  findUnique(args: Record<string, unknown>): Promise<TRecord | null>;
  findFirst(args: Record<string, unknown>): Promise<TRecord | null>;
  findMany(args: Record<string, unknown>): Promise<TRecord[]>;
  create(args: Record<string, unknown>): Promise<TRecord>;
  update(args: Record<string, unknown>): Promise<TRecord>;
};

type EventManagementPrismaClient = {
  hacker: Pick<Delegate<HackerRecord>, 'findUnique'>;
  chapterMembership: Pick<Delegate<ChapterMembershipRecord>, 'findMany'>;
  eventStaff: Pick<Delegate<EventStaffRecord>, 'findMany'>;
  eventRegistration: Pick<Delegate<EventRegistrationRecord>, 'findMany'>;
  hackerOrganizerNote: Delegate<HackerOrganizerNote>;
  hackerOrganizerNoteRevision: Delegate<HackerOrganizerNoteRevision>;
  $transaction<T>(
    callback: (tx: EventManagementPrismaClient) => Promise<T>
  ): Promise<T>;
};

export type OrganizerNoteRelevantEventStaff = {
  eventId: EntityId;
  chapterId?: EntityId | null;
  role: EventStaffRole;
};

export type OrganizerNoteRelevance = {
  actorId?: EntityId | null;
  targetHackerId: EntityId;
  isSiteAdmin: boolean;
  chapterAdminChapterIds: EntityId[];
  assignedEventStaff: OrganizerNoteRelevantEventStaff[];
  targetChapterIds: EntityId[];
  targetEventIds: EntityId[];
};

export type OrganizerNoteRevisionInput = {
  previousBody: string;
  nextBody: string;
};

export type UpdateCurrentOrganizerNoteInput = {
  hackerId: EntityId;
  actorId: EntityId;
  body: string;
};

export type OrganizerNoteRevisionListOptions = {
  take?: number;
  skip?: number;
};
const MAX_ORGANIZER_NOTE_REVISION_PAGE_SIZE = 100;

export type OrganizerNoteAccessForActor = {
  relevance: OrganizerNoteRelevance;
  access: OrganizerNoteAccess;
};

const client = prisma as unknown as EventManagementPrismaClient;

export function hasSharedOrganizerNoteChapter(
  relevance: Pick<
    OrganizerNoteRelevance,
    'chapterAdminChapterIds' | 'targetChapterIds'
  >
): boolean {
  return relevance.chapterAdminChapterIds.some(chapterId =>
    relevance.targetChapterIds.includes(chapterId)
  );
}

export function hasSharedOrganizerNoteEvent(
  relevance: Pick<
    OrganizerNoteRelevance,
    'assignedEventStaff' | 'targetEventIds'
  >
): boolean {
  return relevance.assignedEventStaff.some(staff =>
    relevance.targetEventIds.includes(staff.eventId)
  );
}

export function canViewCurrentOrganizerNote(
  relevance: OrganizerNoteRelevance
): boolean {
  return (
    relevance.isSiteAdmin ||
    hasSharedOrganizerNoteChapter(relevance) ||
    hasSharedOrganizerNoteEvent(relevance)
  );
}

export function canEditCurrentOrganizerNote(
  relevance: OrganizerNoteRelevance
): boolean {
  return canViewCurrentOrganizerNote(relevance);
}

export function canViewOrganizerNoteRevisions(
  relevance: OrganizerNoteRelevance
): boolean {
  return relevance.isSiteAdmin || hasSharedOrganizerNoteChapter(relevance);
}

export function getOrganizerNoteAccess(
  relevance: OrganizerNoteRelevance
): OrganizerNoteAccess {
  return {
    canViewCurrentNote: canViewCurrentOrganizerNote(relevance),
    canEditCurrentNote: canEditCurrentOrganizerNote(relevance),
    canViewRevisions: canViewOrganizerNoteRevisions(relevance),
  };
}

export function buildOrganizerNoteRevisionPatchText({
  previousBody,
  nextBody,
}: OrganizerNoteRevisionInput): string {
  const previousLines = previousBody.length > 0 ? previousBody.split('\n') : [];
  const nextLines = nextBody.length > 0 ? nextBody.split('\n') : [];

  return [
    '--- previous',
    '+++ current',
    ...previousLines.map(line => `-${line}`),
    ...nextLines.map(line => `+${line}`),
  ].join('\n');
}

export async function getOrganizerNoteRelevance(
  actorId: EntityId | null | undefined,
  targetHackerId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<OrganizerNoteRelevance> {
  if (!actorId) {
    return {
      actorId,
      targetHackerId,
      isSiteAdmin: false,
      chapterAdminChapterIds: [],
      assignedEventStaff: [],
      targetChapterIds: [],
      targetEventIds: [],
    };
  }

  const [
    actor,
    chapterAdminMemberships,
    assignedStaff,
    targetMemberships,
    targetRegistrations,
  ] = await Promise.all([
    db.hacker.findUnique({
      where: { id: actorId },
      select: { id: true, role: true },
    }),
    db.chapterMembership.findMany({
      where: {
        hackerId: actorId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { chapterId: true },
    }),
    db.eventStaff.findMany({
      where: { hackerId: actorId },
      select: {
        eventId: true,
        role: true,
        event: { select: { chapterId: true } },
      },
    }),
    db.chapterMembership.findMany({
      where: {
        hackerId: targetHackerId,
        status: { in: ['INVITED', 'ACTIVE'] },
      },
      select: { chapterId: true },
    }),
    db.eventRegistration.findMany({
      where: {
        hackerId: targetHackerId,
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        eventId: true,
        event: { select: { chapterId: true } },
      },
    }),
  ]);

  const targetChapterIds = uniqueIds([
    ...targetMemberships.map(membership => membership.chapterId),
    ...targetRegistrations
      .map(registration => registration.event?.chapterId)
      .filter(isEntityId),
  ]);

  return {
    actorId,
    targetHackerId,
    isSiteAdmin: isSiteAdminRole(actor?.role),
    chapterAdminChapterIds: uniqueIds(
      chapterAdminMemberships.map(membership => membership.chapterId)
    ),
    assignedEventStaff: assignedStaff.map(staff => ({
      eventId: staff.eventId,
      chapterId: staff.event?.chapterId ?? null,
      role: staff.role,
    })),
    targetChapterIds,
    targetEventIds: uniqueIds(
      targetRegistrations.map(registration => registration.eventId)
    ),
  };
}

export async function getCurrentOrganizerNote(
  hackerId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNote | null> {
  return db.hackerOrganizerNote.findUnique({
    where: { hackerId },
  });
}

export async function getCurrentOrganizerNoteForActor(
  actorId: EntityId | null | undefined,
  targetHackerId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNote | null> {
  const relevance = await getOrganizerNoteRelevance(
    actorId,
    targetHackerId,
    db
  );

  if (!canViewCurrentOrganizerNote(relevance)) {
    return null;
  }

  return getCurrentOrganizerNote(targetHackerId, db);
}

export async function getOrganizerNoteAccessForActor(
  actorId: EntityId | null | undefined,
  targetHackerId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<OrganizerNoteAccessForActor> {
  const relevance = await getOrganizerNoteRelevance(
    actorId,
    targetHackerId,
    db
  );

  return {
    relevance,
    access: getOrganizerNoteAccess(relevance),
  };
}

export async function updateCurrentOrganizerNote(
  input: UpdateCurrentOrganizerNoteInput,
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNote> {
  return db.$transaction(async tx => {
    const existingNote = await tx.hackerOrganizerNote.findUnique({
      where: { hackerId: input.hackerId },
    });

    if (existingNote?.body === input.body) {
      return existingNote;
    }

    const note = existingNote
      ? await tx.hackerOrganizerNote.update({
          where: { id: existingNote.id },
          data: {
            body: input.body,
            updatedById: input.actorId,
          },
        })
      : await tx.hackerOrganizerNote.create({
          data: {
            hackerId: input.hackerId,
            body: input.body,
            updatedById: input.actorId,
          },
        });

    await tx.hackerOrganizerNoteRevision.create({
      data: {
        noteId: note.id,
        hackerId: input.hackerId,
        editedById: input.actorId,
        patchText: buildOrganizerNoteRevisionPatchText({
          previousBody: existingNote?.body ?? '',
          nextBody: input.body,
        }),
      },
    });

    return note;
  });
}

export async function updateCurrentOrganizerNoteForActor(
  actorId: EntityId | null | undefined,
  targetHackerId: EntityId,
  body: string,
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNote | null> {
  if (!actorId) {
    return null;
  }

  const relevance = await getOrganizerNoteRelevance(
    actorId,
    targetHackerId,
    db
  );

  if (!canEditCurrentOrganizerNote(relevance)) {
    return null;
  }

  return updateCurrentOrganizerNote(
    {
      hackerId: targetHackerId,
      actorId,
      body,
    },
    db
  );
}

type EventScopedOrganizerNoteInput = {
  eventId: EntityId;
  actorId: EntityId;
  targetHackerId: EntityId;
  db?: any;
};

type EventScopedOrganizerNoteContext = {
  event: { id: EntityId; chapterId: EntityId };
  actor: { id: EntityId; role?: Role | null };
  isSiteAdmin: boolean;
  isChapterAdmin: boolean;
  isEventStaff: boolean;
};

async function getEventScopedOrganizerNoteContext(
  eventId: EntityId,
  actorId: EntityId,
  db: any
): Promise<EventScopedOrganizerNoteContext | null> {
  const [event, actor] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      select: { id: true, chapterId: true },
    }),
    db.hacker.findUnique({
      where: { id: actorId },
      select: { id: true, role: true },
    }),
  ]);
  if (!event || !actor) return null;

  if (isSiteAdminRole(actor.role)) {
    return {
      event,
      actor,
      isSiteAdmin: true,
      isChapterAdmin: false,
      isEventStaff: false,
    };
  }

  const [membership, staff] = await Promise.all([
    db.chapterMembership.findFirst({
      where: {
        chapterId: event.chapterId,
        hackerId: actorId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { role: true, status: true },
    }),
    db.eventStaff.findFirst({
      where: { eventId, hackerId: actorId },
      select: { role: true },
    }),
  ]);

  const isChapterAdmin =
    membership?.role === 'ADMIN' && membership.status === 'ACTIVE';
  const isEventStaff = staff?.role === 'MC' || staff?.role === 'CO_MC';
  if (!isChapterAdmin && !isEventStaff) return null;

  return {
    event,
    actor,
    isSiteAdmin: false,
    isChapterAdmin,
    isEventStaff,
  };
}

async function targetIsRelevantToEvent(
  eventId: EntityId,
  targetHackerId: EntityId,
  db: any
) {
  const registration = await db.eventRegistration.findFirst({
    where: {
      eventId,
      hackerId: targetHackerId,
      status: { not: 'CANCELLED' },
    },
    select: { id: true, eventId: true },
  });
  if (registration) return true;

  if (!db.eventProject?.findFirst) return false;
  const projectParticipation = await db.eventProject.findFirst({
    where: {
      eventId,
      project: {
        OR: [
          { launchLeadId: targetHackerId },
          { participants: { some: { hackerId: targetHackerId } } },
        ],
      },
    },
    select: { id: true },
  });
  return !!projectParticipation;
}

async function targetIsHiddenByGlobalBan(
  targetHackerId: EntityId,
  context: EventScopedOrganizerNoteContext,
  db: any
) {
  if (context.isSiteAdmin) return false;
  const ban = await db.userBan.findFirst({
    where: { hackerId: targetHackerId, revokedAt: null },
    select: { id: true },
  });
  return !!ban;
}

async function canAccessEventScopedTarget(
  input: EventScopedOrganizerNoteInput,
  db: any
) {
  const context = await getEventScopedOrganizerNoteContext(
    input.eventId,
    input.actorId,
    db
  );
  if (!context) return null;
  const relevant = await targetIsRelevantToEvent(
    input.eventId,
    input.targetHackerId,
    db
  );
  if (!relevant) return null;
  if (await targetIsHiddenByGlobalBan(input.targetHackerId, context, db)) {
    return null;
  }
  return context;
}

export async function getCurrentOrganizerNoteForEventActor({
  db = client,
  ...input
}: EventScopedOrganizerNoteInput) {
  if (!(await canAccessEventScopedTarget(input, db))) return null;
  return db.hackerOrganizerNote.findUnique({
    where: { hackerId: input.targetHackerId },
  });
}

export async function updateCurrentOrganizerNoteForEventActor({
  db = client,
  body,
  ...input
}: EventScopedOrganizerNoteInput & { body: string }) {
  if (!(await canAccessEventScopedTarget(input, db))) return null;
  return updateCurrentOrganizerNote(
    {
      hackerId: input.targetHackerId,
      actorId: input.actorId,
      body,
    },
    db
  );
}

export async function listEventOrganizerNoteTargets({
  db = client,
  eventId,
  actorId,
  search,
  take = 50,
  skip = 0,
}: {
  db?: any;
  eventId: EntityId;
  actorId: EntityId;
  search?: string;
  take?: number;
  skip?: number;
}) {
  const context = await getEventScopedOrganizerNoteContext(
    eventId,
    actorId,
    db
  );
  if (!context) return [];

  const registrations = await db.eventRegistration.findMany({
    where: {
      eventId,
      status: { not: 'CANCELLED' },
      ...(search?.trim()
        ? {
            hacker: {
              name: { contains: search.trim(), mode: 'insensitive' },
            },
          }
        : {}),
    },
    select: {
      hacker: {
        select: {
          id: true,
          name: true,
          organizerNote: {
            select: {
              id: true,
              body: true,
              updatedAt: true,
              updatedById: true,
            },
          },
        },
      },
    },
    orderBy: [{ hacker: { name: 'asc' } }, { hackerId: 'asc' }],
    take: Math.min(Math.max(take, 1), 100),
    skip: Math.max(skip, 0),
  });

  const rows = [];
  const seen = new Set<string>();
  for (const registration of registrations) {
    const hacker = registration.hacker;
    if (!hacker || seen.has(hacker.id)) continue;
    seen.add(hacker.id);
    if (await targetIsHiddenByGlobalBan(hacker.id, context, db)) continue;
    rows.push({
      hackerId: hacker.id,
      name: hacker.name,
      note: hacker.organizerNote ?? null,
    });
  }
  return rows;
}

export async function listOrganizerNoteRevisionsForEventActor({
  db = client,
  take = 50,
  skip = 0,
  ...input
}: EventScopedOrganizerNoteInput & { take?: number; skip?: number }) {
  const context = await canAccessEventScopedTarget(input, db);
  if (!context || (!context.isSiteAdmin && !context.isChapterAdmin)) {
    return null;
  }
  return db.hackerOrganizerNoteRevision.findMany({
    where: { hackerId: input.targetHackerId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(take, 1), 100),
    skip: Math.max(skip, 0),
  });
}

export async function listOrganizerNoteRevisions(
  hackerId: EntityId,
  options: OrganizerNoteRevisionListOptions = {},
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNoteRevision[]> {
  const take = Math.min(
    Math.max(options.take ?? 50, 1),
    MAX_ORGANIZER_NOTE_REVISION_PAGE_SIZE
  );
  return db.hackerOrganizerNoteRevision.findMany({
    where: { hackerId },
    orderBy: { createdAt: 'desc' },
    take,
    skip: Math.max(options.skip ?? 0, 0),
  });
}

export async function listOrganizerNoteRevisionsForActor(
  actorId: EntityId | null | undefined,
  targetHackerId: EntityId,
  options: OrganizerNoteRevisionListOptions = {},
  db: EventManagementPrismaClient = client
): Promise<HackerOrganizerNoteRevision[] | null> {
  const relevance = await getOrganizerNoteRelevance(
    actorId,
    targetHackerId,
    db
  );

  if (!canViewOrganizerNoteRevisions(relevance)) {
    return null;
  }

  return listOrganizerNoteRevisions(targetHackerId, options, db);
}

function uniqueIds(ids: EntityId[]): EntityId[] {
  return Array.from(new Set(ids));
}

function isEntityId(value: EntityId | null | undefined): value is EntityId {
  return typeof value === 'string' && value.length > 0;
}
