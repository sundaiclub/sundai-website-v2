// Shared trending score used by both client and server.
// Matches the client-side logic from ProjectSearch/TrendingSections.

export type Trendable = {
  likes?: Array<{ hackerId?: string; createdAt?: string | Date }>;
  startDate?: string | Date;
  createdAt?: string | Date;
};

export function calculateTrendingScore(
  project: Trendable,
  options: { timeDecayDays?: number } = {}
): number {
  const { timeDecayDays } = options;

  const likesCount = (project.likes?.length as number) || 0;

  if (timeDecayDays === undefined) {
    return likesCount;
  }

  const rawDate = (project.startDate as any) || (project.createdAt as any);
  const projectDate = new Date(rawDate);
  if (Number.isNaN(projectDate.getTime())) {
    return likesCount;
  }

  const now = new Date();
  const projectAgeInDays = (now.getTime() - projectDate.getTime()) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.exp(-projectAgeInDays / timeDecayDays);
  return likesCount * decayFactor;
}

// Alias with the same name used in client code
export function calculateProjectScore(
  project: Trendable,
  options: { timeDecayDays?: number } = {}
): number {
  return calculateTrendingScore(project, options);
}


