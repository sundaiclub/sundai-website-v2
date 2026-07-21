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
        thumbnail: { select: { url: true, alt: true } },
        launchLead: { select: { name: true } },
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
        id: row.project.id,
        title: row.project.title,
        preview: row.project.preview ?? null,
        thumbnail: row.project.thumbnail ?? null,
        launchLeadName: row.project.launchLead.name,
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
        launchLead: { userBans: { none: { revokedAt: null } } },
      },
    },
    select: publicEventProjectSelect(eventId),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return rankPublicEventProjects(rows);
}
