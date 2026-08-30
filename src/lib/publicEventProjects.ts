import prisma from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { PublicEventProject } from '@/types/event-management';

function publicEventProjectSelect(eventId: string) {
  return {
    createdAt: true,
    project: {
      select: {
        id: true,
        title: true,
        preview: true,
        description: true,
        githubUrl: true,
        demoUrl: true,
        blogUrl: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        is_starred: true,
        is_broken: true,
        thumbnail: { select: { url: true, alt: true, prompt: true } },
        launchLead: {
          select: {
            id: true,
            name: true,
            twitterUrl: true,
            linkedinUrl: true,
            avatar: { select: { url: true } },
          },
        },
        participants: {
          select: {
            role: true,
            hacker: {
              select: {
                id: true,
                name: true,
                bio: true,
                twitterUrl: true,
                linkedinUrl: true,
                avatar: { select: { url: true } },
              },
            },
          },
        },
        techTags: {
          select: { id: true, name: true, description: true },
        },
        domainTags: {
          select: { id: true, name: true, description: true },
        },
        likes: {
          where: { hacker: { userBans: { none: { revokedAt: null } } } },
          select: { hackerId: true, createdAt: true },
        },
        pitchEntries: {
          where: { pitchSession: { eventId } },
          select: {
            pitchVotes: {
              where: {
                value: 'LIKE',
                hacker: { userBans: { none: { revokedAt: null } } },
              },
              select: { id: true },
            },
          },
        },
      },
    },
  } satisfies Prisma.EventProjectSelect;
}

type EventProjectRow = Prisma.EventProjectGetPayload<{
  select: ReturnType<typeof publicEventProjectSelect>;
}>;

export function rankPublicEventProjects(
  rows: EventProjectRow[]
): PublicEventProject[] {
  return rows
    .map(row => ({
      project: {
        ...row.project,
        preview: row.project.preview ?? '',
        description: row.project.description ?? '',
        participants: row.project.participants.map(participant => ({
          ...participant,
          role: participant.role ?? '',
        })),
        likes: row.project.likes.map(like => ({
          ...like,
          createdAt: like.createdAt.toISOString(),
        })),
        createdAt: row.project.createdAt.toISOString(),
        updatedAt: row.project.updatedAt.toISOString(),
        pitchVoteCount: row.project.pitchEntries.reduce(
          (total, entry) => total + entry.pitchVotes.length,
          0
        ),
      },
      eventProjectCreatedAt: new Date(row.createdAt).getTime(),
    }))
    .sort(
      (a, b) =>
        b.project.pitchVoteCount - a.project.pitchVoteCount ||
        a.eventProjectCreatedAt - b.eventProjectCreatedAt ||
        a.project.title.localeCompare(b.project.title)
    )
    .map(item => item.project);
}

export async function listPublicEventProjects({
  eventId,
  db = prisma,
}: {
  eventId: string;
  db?: Pick<PrismaClient, 'eventProject'>;
}): Promise<PublicEventProject[]> {
  const rows = await db.eventProject.findMany({
    where: {
      eventId,
      project: {
        is_broken: false,
        status: 'APPROVED',
        launchLead: { userBans: { none: { revokedAt: null } } },
      },
    },
    select: publicEventProjectSelect(eventId),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return rankPublicEventProjects(rows);
}
