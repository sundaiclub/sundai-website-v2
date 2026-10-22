import type { Prisma } from '@prisma/client';
import { visibleProjectsWhere } from '@/lib/projectVisibility';
import { requireEventOperationsManager } from '@/lib/eventManagementApi';
import { resolveEventJudge } from '@/lib/judgingAccess';

/** Event links grant access only after checking the viewer's event role. */
export async function projectReadAccessWhere(
  clerkId: string | null,
  eventId: string | null,
  judgeToken: string | null
): Promise<Prisma.ProjectWhereInput> {
  const visibility = visibleProjectsWhere(clerkId);
  if (!eventId) return visibility;

  if (clerkId) {
    const access = await requireEventOperationsManager(eventId);
    if (!access.response) {
      return { eventParticipations: { some: { eventId } } };
    }
  }
  const judge = await resolveEventJudge(eventId, judgeToken);
  if (!judge) return visibility;
  return {
    OR: [
      visibility,
      {
        judgingSubmissions: {
          some: {
            eventId,
            event: {
              judgingEnabled: true,
              judgingAssignmentsPublishedAt: { not: null },
            },
            assignments: { some: { judgeId: judge.id } },
          },
        },
      },
    ],
  };
}
