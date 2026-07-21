import prisma from '@/lib/prisma';
import type { PublicEventProject } from '@/types/event-management';

type EventProjectRow = {
  createdAt: Date | string;
  project: {
    id: string;
    title: string;
    preview?: string | null;
    thumbnail?: {
      url: string;
      alt?: string | null;
    } | null;
    launchLead: { name: string };
    pitchEntries: Array<{
      pitchVotes: Array<{ id: string }>;
    }>;
  };
};

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
  db?: any;
}): Promise<PublicEventProject[]> {
  const rows = (await db.eventProject.findMany({
    where: {
      eventId,
      project: {
        is_broken: false,
        launchLead: { userBans: { none: { revokedAt: null } } },
      },
    },
    select: {
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
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })) as EventProjectRow[];

  return rankPublicEventProjects(rows);
}
