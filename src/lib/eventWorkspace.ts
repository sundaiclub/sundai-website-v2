import type { Hacker, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  canAccessEventWorkspaceWithContext,
  canAdministerEventWithContext,
  canDecideEventApplicantsWithContext,
  canManageEventCommunicationsWithContext,
  canManageEventMaterialsWithContext,
  canManageEventNotesWithContext,
  canManageEventOperationsWithContext,
  canManageEventPitchWithContext,
  isSiteAdminActor,
} from '@/lib/eventManagementAuth';
import type {
  EventWorkspaceCapabilities,
  EventWorkspaceOverview,
  WorkspaceRegistrationCounts,
} from '@/types/event-workspace';

type WorkspaceActor = Pick<Hacker, 'id' | 'role'>;
const MAX_WORKSPACE_STAFF = 100;

const AVAILABLE_SECTIONS: EventWorkspaceOverview['availableSections'] = [
  'overview',
  'registrations',
  'communications',
  'materials',
  'projects',
  'pitch',
  'notes',
  'reporting',
];

export function getAvailableWorkspaceSections(
  canReviewRsvps: boolean
): EventWorkspaceOverview['availableSections'] {
  return canReviewRsvps
    ? [...AVAILABLE_SECTIONS]
    : AVAILABLE_SECTIONS.filter(section => section !== 'registrations');
}

const WORKSPACE_UNAVAILABLE_METRICS: EventWorkspaceOverview['unavailable'] = [
  'checkIn',
  'attendance',
  'noShows',
];

function projectCapabilities(
  actor: WorkspaceActor,
  chapterMembership: {
    role: 'MEMBER' | 'ADMIN';
    status: 'INVITED' | 'ACTIVE' | 'REVOKED' | 'LEFT';
  } | null,
  staff: { role: 'MC' | 'CO_MC' } | null
): EventWorkspaceCapabilities {
  const context = { actor, chapterMembership, staff };
  const administerEvent = canAdministerEventWithContext(context);

  return {
    administerEvent,
    assignStaff: administerEvent,
    decideApplicants: canDecideEventApplicantsWithContext(context),
    manageOperations: canManageEventOperationsWithContext(context),
    sendCommunications: canManageEventCommunicationsWithContext(context),
    manageMaterials: canManageEventMaterialsWithContext(context),
    managePitch: canManageEventPitchWithContext(context),
    editNotes: canManageEventNotesWithContext(context),
    viewNoteHistory: administerEvent,
  };
}

function registrationCounts(
  groups: Array<{ status: string; _count?: unknown }>
): WorkspaceRegistrationCounts {
  const counts: WorkspaceRegistrationCounts = {
    pending: 0,
    approved: 0,
    waitlisted: 0,
    declined: 0,
    cancelled: 0,
  };

  for (const group of groups) {
    const key = group.status.toLowerCase() as keyof WorkspaceRegistrationCounts;
    const aggregate = group._count as { _all?: number } | undefined;
    if (key in counts) counts[key] = aggregate?._all ?? 0;
  }

  return counts;
}

async function resolveActor(actor: WorkspaceActor | string) {
  if (typeof actor !== 'string') return actor;
  return prisma.hacker.findUnique({
    where: { id: actor },
    select: { id: true, role: true },
  });
}

/**
 * Builds the complete organizer overview from current event scope. The loader
 * rechecks access so it is safe to call independently of an API route guard.
 */
export async function loadEventWorkspace(
  eventId: string,
  actorInput: WorkspaceActor | string
): Promise<EventWorkspaceOverview | null> {
  const actor = await resolveActor(actorInput);
  if (!actor) return null;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      startTime: true,
      endTime: true,
      capacity: true,
      applicationMode: true,
      applicationsOpen: true,
      autoPromoteWaitlist: true,
      approvedDetailsJson: true,
      slug: true,
      chapterId: true,
      chapter: { select: { id: true, name: true, slug: true, timezone: true } },
      publicationNotification: {
        select: {
          status: true,
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          emailRecipientCount: true,
          smsRecipientCount: true,
          sentAt: true,
        },
      },
      staff: {
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        // Event staff is displayed inline; keep the relation include bounded.
        take: MAX_WORKSPACE_STAFF,
        select: {
          id: true,
          hackerId: true,
          role: true,
          hacker: { select: { name: true } },
        },
      },
    },
  });
  if (!event) return null;

  const [chapterMembership, actorStaff] = await Promise.all([
    prisma.chapterMembership.findFirst({
      where: { chapterId: event.chapterId, hackerId: actor.id },
      select: { role: true, status: true },
    }),
    prisma.eventStaff.findUnique({
      where: { eventId_hackerId: { eventId, hackerId: actor.id } },
      select: { role: true },
    }),
  ]);
  const permissionContext = { actor, chapterMembership, staff: actorStaff };
  if (!canAccessEventWorkspaceWithContext(permissionContext)) return null;

  const registrationWhere: Prisma.EventRegistrationWhereInput = {
    eventId,
    status: { not: 'BLOCKED' },
  };
  if (!isSiteAdminActor(actor)) {
    registrationWhere.hacker = { userBans: { none: { revokedAt: null } } };
  }
  const projectWhere = {
    eventId,
    ...(!isSiteAdminActor(actor) && {
      project: { launchLead: { userBans: { none: { revokedAt: null } } } },
    }),
  };
  const pitchProjectWhere = {
    pitchSession: { eventId },
    ...(!isSiteAdminActor(actor) && {
      project: { launchLead: { userBans: { none: { revokedAt: null } } } },
    }),
  };

  const [
    registrationGroups,
    projectTotal,
    submittedCards,
    queuedProjects,
    pitchedProjects,
    highlightedProjects,
    materialCount,
    communicationCount,
  ] = await prisma.$transaction([
    prisma.eventRegistration.groupBy({
      by: ['status'],
      where: registrationWhere,
      orderBy: { status: 'asc' },
      _count: { _all: true },
    }),
    prisma.eventProject.count({ where: projectWhere }),
    prisma.eventProject.count({
      where: {
        ...projectWhere,
        cardStatus: { in: ['SUBMITTED', 'APPROVED'] },
      },
    }),
    prisma.pitchProject.count({
      where: {
        ...pitchProjectWhere,
        status: { in: ['QUEUED', 'APPROVED', 'CURRENT'] },
      },
    }),
    prisma.pitchProject.count({
      where: { ...pitchProjectWhere, status: 'DONE' },
    }),
    prisma.pitchProject.count({
      where: { ...pitchProjectWhere, isTopProject: true },
    }),
    prisma.eventMaterial.count({ where: { eventId } }),
    prisma.eventCommunication.count({ where: { eventId } }),
  ]);

  return {
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      chapter: event.chapter,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime?.toISOString() ?? '',
      capacity: event.capacity,
      applicationMode: event.applicationMode,
      applicationsOpen: event.applicationsOpen,
      autoPromoteWaitlist: event.autoPromoteWaitlist,
      publicUrl: `/events/${event.chapter.slug}/${event.slug}`,
      hasApprovedOnlyDetails: event.approvedDetailsJson !== null,
    },
    capabilities: projectCapabilities(actor, chapterMembership, actorStaff),
    staff: event.staff.map(member => ({
      id: member.id,
      hackerId: member.hackerId,
      name: member.hacker.name,
      role: member.role,
    })),
    counts: {
      registrations: registrationCounts(registrationGroups),
      projects: { total: projectTotal, submittedCards },
      pitch: {
        queued: queuedProjects,
        pitched: pitchedProjects,
        highlighted: highlightedProjects,
      },
      materials: materialCount,
      communications: communicationCount,
    },
    availableSections: getAvailableWorkspaceSections(
      canDecideEventApplicantsWithContext(permissionContext)
    ),
    unavailable: [...WORKSPACE_UNAVAILABLE_METRICS],
    publicationNotification: event.publicationNotification
      ? {
          ...event.publicationNotification,
          sentAt: event.publicationNotification.sentAt?.toISOString() ?? null,
        }
      : null,
  };
}
