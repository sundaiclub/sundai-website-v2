import type { Prisma } from '@prisma/client';
import { judgingSubmissionWindowWhere } from '@/lib/judgingData';

/** Use the submission dates for judging events, and event dates otherwise. */
export function projectEventWindowWhere(now: Date): Prisma.EventWhereInput {
  return {
    OR: [
      { judgingEnabled: false, startTime: { lte: now }, endTime: { gte: now } },
      judgingSubmissionWindowWhere(now),
    ],
  };
}

export function projectEventAccessWhere(hacker: {
  id: string;
  role: string | null;
}): Prisma.EventWhereInput {
  return {
    status: 'PUBLISHED',
    ...(hacker.role === 'SITE_ADMIN'
      ? {}
      : {
          OR: [
            {
              registrations: {
                some: {
                  hackerId: hacker.id,
                  status: 'APPROVED' as const,
                  cancelledAt: null,
                },
              },
            },
            { staff: { some: { hackerId: hacker.id } } },
            {
              chapter: {
                memberships: {
                  some: {
                    hackerId: hacker.id,
                    role: 'ADMIN' as const,
                    status: 'ACTIVE' as const,
                  },
                },
              },
            },
          ],
        }),
  };
}
