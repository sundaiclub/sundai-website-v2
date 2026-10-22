import type { Prisma } from '@prisma/client';

/** A project stays private while any event it belongs to hides its projects. */
export function visibleProjectsWhere(
  clerkId?: string | null
): Prisma.ProjectWhereInput {
  const publicProjects: Prisma.ProjectWhereInput = {
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
