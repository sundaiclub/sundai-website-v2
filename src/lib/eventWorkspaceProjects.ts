import prisma from '@/lib/prisma';
import type { EventProjectCardStatus } from '@/types/event-workspace';

const CARD_STATUSES = new Set<EventProjectCardStatus>([
  'DRAFT',
  'NEEDS_INFO',
  'SUBMITTED',
  'APPROVED',
]);
const MAX_PITCH_SESSIONS_IN_SUMMARY = 100;

function projectInclude(includeBanned: boolean) {
  const banSafeHackerWhere = includeBanned
    ? undefined
    : { userBans: { none: { revokedAt: null } } };
  return {
    pitchSession: {
      select: { id: true, eventId: true, phase: true, title: true },
    },
    pitchVotes: {
      ...(banSafeHackerWhere ? { where: { hacker: banSafeHackerWhere } } : {}),
      select: { value: true },
    },
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
      },
    },
  };
}

export function projectEventWorkspacePitchProject(entry: any) {
  const likes = entry.pitchVotes.filter(
    (vote: { value: string }) => vote.value === 'LIKE'
  ).length;
  const dislikes = entry.pitchVotes.filter(
    (vote: { value: string }) => vote.value === 'DISLIKE'
  ).length;

  return {
    id: entry.id,
    pitchSessionId: entry.pitchSessionId,
    cardStatus: entry.cardStatus,
    project: {
      id: entry.project.id,
      title: entry.project.title,
      preview: entry.project.preview ?? null,
      description: entry.project.description ?? null,
      githubUrl: entry.project.githubUrl ?? null,
      demoUrl: entry.project.demoUrl ?? null,
      blogUrl: entry.project.blogUrl ?? null,
      thumbnail: entry.project.thumbnail ?? null,
      launchLead: entry.project.launchLead,
      participants: entry.project.participants.map(
        (participant: { hacker: unknown }) => participant.hacker
      ),
      techTags: entry.project.techTags,
      domainTags: entry.project.domainTags,
    },
    queue: {
      status: entry.status,
      position: entry.position,
      approved: entry.approved,
    },
    pitch: {
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
    },
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
  const rows = await db.pitchProject.findMany({
    where: {
      pitchSession: { eventId },
      ...(includeBanned
        ? {}
        : {
            project: {
              launchLead: { userBans: { none: { revokedAt: null } } },
            },
          }),
    },
    include: projectInclude(includeBanned),
    orderBy: [
      { pitchSession: { startTime: 'asc' } },
      { position: 'asc' },
      { id: 'asc' },
    ],
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
  pitchProjectId,
  cardStatus,
}: {
  db?: any;
  eventId: string;
  pitchProjectId: string;
  cardStatus: EventProjectCardStatus;
}) {
  if (!CARD_STATUSES.has(cardStatus)) {
    throw new Error('Project card status is invalid.');
  }
  const existing = await db.pitchProject.findFirst({
    where: { id: pitchProjectId, pitchSession: { eventId } },
    select: { id: true },
  });
  if (!existing) return null;

  return db.pitchProject.update({
    where: { id: pitchProjectId },
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
  const [total, queued, pitched, highlighted, submittedCards, sessions] =
    await db.$transaction([
      db.pitchProject.count({ where }),
      db.pitchProject.count({
        where: {
          ...where,
          status: { in: ['QUEUED', 'APPROVED', 'CURRENT'] },
        },
      }),
      db.pitchProject.count({ where: { ...where, status: 'DONE' } }),
      db.pitchProject.count({ where: { ...where, isTopProject: true } }),
      db.pitchProject.count({
        where: {
          ...where,
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
