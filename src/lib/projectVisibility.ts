import type { Prisma } from '@prisma/client';

/** Drafts and projects hidden by an event are readable only by their team. */
export function visibleProjectsWhere(
  clerkId?: string | null,
  isSiteAdmin = false
): Prisma.ProjectWhereInput {
  if (isSiteAdmin) return {};
  const publicProjects: Prisma.ProjectWhereInput = {
    status: 'APPROVED',
    eventParticipations: { none: { event: { projectsHidden: true } } },
  };
  if (!clerkId) return publicProjects;
  return {
    OR: [
      publicProjects,
      { launchLead: { clerkId } },
      { participants: { some: { hacker: { clerkId } } } },
    ],
  };
}
