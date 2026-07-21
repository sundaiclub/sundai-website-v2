import prisma from '@/lib/prisma';
import type { EventProjectCardStatus } from '@/types/event-workspace';

const CARD_STATUSES = new Set<EventProjectCardStatus>([
  'DRAFT',
  'NEEDS_INFO',
  'SUBMITTED',
  'APPROVED',
]);
const MAX_PITCH_SESSIONS_IN_SUMMARY = 100;

function projectInclude(eventId: string, includeBanned: boolean) {
  const banSafeHackerWhere = includeBanned
    ? undefined
    : { userBans: { none: { revokedAt: null } } };
  return {
    project: {
      include: {
        thumbnail: true,
        launchLead: {
          select: { id: true, name: true, avatar: true },
        },
        participants: {
          ...(banSafeHackerWhere
            ? { where: { hacker: banSafeHackerWhere } }
            : {}),
          include: {
            hacker: { select: { id: true, name: true, avatar: true } },
          },
        },
        techTags: { select: { id: true, name: true } },
        domainTags: { select: { id: true, name: true } },
        pitchEntries: {
          where: { pitchSession: { eventId } },
          include: {
            pitchSession: {
              select: { id: true, eventId: true, phase: true, title: true },
            },
            pitchVotes: {
              ...(banSafeHackerWhere
                ? { where: { hacker: banSafeHackerWhere } }
                : {}),
              select: { value: true },
            },
          },
          orderBy: [{ pitchSession: { startTime: 'asc' } }, { position: 'asc' }],
        },
      },
    },
  };
}

export function projectEventWorkspacePitchProject(participation: any) {
  const entry = participation.project.pitchEntries.find(
    (candidate: any) => candidate.pitchSession.eventId === participation.eventId
  );
  const votes = entry?.pitchVotes ?? [];
  const likes = votes.filter(
    (vote: { value: string }) => vote.value === 'LIKE'
  ).length;
  const dislikes = votes.filter(
    (vote: { value: string }) => vote.value === 'DISLIKE'
  ).length;

  return {
    id: participation.id,
    pitchProjectId: entry?.id ?? null,
    pitchSessionId: entry?.pitchSessionId ?? null,
    cardStatus: participation.cardStatus,
    project: {
      id: participation.project.id,
      title: participation.project.title,
      preview: participation.project.preview ?? null,
      description: participation.project.description ?? null,
      githubUrl: participation.project.githubUrl ?? null,
      demoUrl: participation.project.demoUrl ?? null,
      blogUrl: participation.project.blogUrl ?? null,
      thumbnail: participation.project.thumbnail ?? null,
      launchLead: participation.project.launchLead,
      participants: participation.project.participants.map(
        (participant: { hacker: unknown }) => participant.hacker
      ),
      techTags: participation.project.techTags,
      domainTags: participation.project.domainTags,
    },
    queue: entry ? {
      status: entry.status,
      position: entry.position,
      approved: entry.approved,
    } : null,
    pitch: entry ? {
      phase: entry.pitchPhase,
      sessionPhase: entry.pitchSession.phase,
      presentingStartedAt: entry.presentingStartedAt ?? null,
      questionsStartedAt: entry.questionsStartedAt ?? null,
      completedAt: entry.completedAt ?? null,
      pausedAt: entry.pausedAt ?? null,
      allottedPresentingSec: entry.allottedPresentingSec ?? null,
      allottedQuestionsSec: entry.allottedQuestionsSec ?? null,
      isTopProject: entry.isTopProject,
      votes: { likes, dislikes, total: likes + dislikes },
    } : null,
  };
}

export async function listEventWorkspaceProjects({
  db = prisma,
  eventId,
  includeBanned = false,
  take = 50,
  skip = 0,
}: {
  db?: any;
  eventId: string;
  includeBanned?: boolean;
  take?: number;
  skip?: number;
}) {
  const boundedTake = Math.min(Math.max(take, 1), 100);
  const rows = await db.eventProject.findMany({
    where: {
      eventId,
      ...(includeBanned
        ? {}
        : {
            project: {
              launchLead: { userBans: { none: { revokedAt: null } } },
            },
          }),
    },
    include: projectInclude(eventId, includeBanned),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: boundedTake + 1,
    skip: Math.max(skip, 0),
  });
  const hasMore = rows.length > boundedTake;
  const page = hasMore ? rows.slice(0, boundedTake) : rows;
  return {
    items: page.map(projectEventWorkspacePitchProject),
    nextOffset: hasMore ? Math.max(skip, 0) + boundedTake : null,
  };
}

export async function updateEventProjectCardStatus({
  db = prisma,
  eventId,
  eventProjectId,
  cardStatus,
}: {
  db?: any;
  eventId: string;
  eventProjectId: string;
  cardStatus: EventProjectCardStatus;
}) {
  if (!CARD_STATUSES.has(cardStatus)) {
    throw new Error('Project card status is invalid.');
  }
  const existing = await db.eventProject.findFirst({
    where: { id: eventProjectId, eventId },
    select: { id: true },
  });
  if (!existing) return null;

  return db.eventProject.update({
    where: { id: eventProjectId },
    data: { cardStatus },
  });
}

export async function getEventWorkspacePitchSummary({
  db = prisma,
  eventId,
  includeBanned = false,
}: {
  db?: any;
  eventId: string;
  includeBanned?: boolean;
}) {
  const where = {
    pitchSession: { eventId },
    ...(includeBanned
      ? {}
      : {
          project: { launchLead: { userBans: { none: { revokedAt: null } } } },
        }),
  };
  const participationWhere = {
    eventId,
    ...(includeBanned
      ? {}
      : {
          project: { launchLead: { userBans: { none: { revokedAt: null } } } },
        }),
  };
  const [total, queued, pitched, highlighted, submittedCards, sessions] =
    await db.$transaction([
      db.eventProject.count({ where: participationWhere }),
      db.pitchProject.count({
        where: {
          ...where,
          status: { in: ['QUEUED', 'APPROVED', 'CURRENT'] },
        },
      }),
      db.pitchProject.count({ where: { ...where, status: 'DONE' } }),
      db.pitchProject.count({ where: { ...where, isTopProject: true } }),
      db.eventProject.count({
        where: {
          ...participationWhere,
          cardStatus: { in: ['SUBMITTED', 'APPROVED'] },
        },
      }),
      db.pitchSession.findMany({
        where: { eventId },
        select: { id: true, title: true, phase: true, startTime: true },
        orderBy: { startTime: 'asc' },
        // Summary metadata is not an unbounded session feed.
        take: MAX_PITCH_SESSIONS_IN_SUMMARY,
      }),
    ]);
  return {
    total,
    queued,
    pitched,
    highlighted,
    submittedCards,
    sessions,
  };
}
