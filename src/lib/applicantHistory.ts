import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { visibleProjectsWhere } from '@/lib/projectVisibility';
import type { ApplicantHistory, EntityId } from '@/types/event-management';

type ApplicantHistoryPrismaClient = Pick<
  PrismaClient,
  'eventRegistration' | 'project'
>;

export const EMPTY_APPLICANT_HISTORY: ApplicantHistory = {
  otherEventsApplied: 0,
  otherEventsAccepted: 0,
  publicProjects: 0,
};

/**
 * Counts each applicant's registrations for other events, how many of those
 * were approved, and how many projects they have on the public site.
 */
export async function getApplicantHistory(
  eventId: EntityId,
  hackerIds: EntityId[],
  db: ApplicantHistoryPrismaClient = prisma
): Promise<Map<EntityId, ApplicantHistory>> {
  const ids = [...new Set(hackerIds)];
  const history = new Map<EntityId, ApplicantHistory>(
    ids.map(id => [id, { ...EMPTY_APPLICANT_HISTORY }])
  );
  if (ids.length === 0) return history;

  const [registrationGroups, projects] = await Promise.all([
    db.eventRegistration.groupBy({
      by: ['hackerId', 'status'],
      where: { hackerId: { in: ids }, eventId: { not: eventId } },
      _count: { _all: true },
    }),
    db.project.findMany({
      where: {
        AND: [
          visibleProjectsWhere(),
          {
            OR: [
              { launchLeadId: { in: ids } },
              { participants: { some: { hackerId: { in: ids } } } },
            ],
          },
        ],
      },
      select: {
        launchLeadId: true,
        participants: {
          where: { hackerId: { in: ids } },
          select: { hackerId: true },
        },
      },
    }),
  ]);

  for (const group of registrationGroups) {
    const entry = history.get(group.hackerId);
    if (!entry) continue;
    entry.otherEventsApplied += group._count._all;
    if (group.status === 'APPROVED') {
      entry.otherEventsAccepted += group._count._all;
    }
  }

  for (const project of projects) {
    const members = new Set([
      project.launchLeadId,
      ...project.participants.map(participant => participant.hackerId),
    ]);
    for (const hackerId of members) {
      const entry = history.get(hackerId);
      if (entry) entry.publicProjects += 1;
    }
  }

  return history;
}
