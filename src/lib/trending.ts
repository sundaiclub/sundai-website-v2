// Shared trending score used by both client and server.
// Matches the client-side logic from ProjectSearch/TrendingSections.

export type Trendable = {
  likes?: Array<{ hackerId?: string; createdAt?: string | Date }>;
};

export function calculateTrendingScore(
  project: Trendable,
  options: { timeDecayDays?: number } = {}
): number {
  const { timeDecayDays } = options;

  const likes = project.likes || [];
  const likesCount = likes.length;

  if (timeDecayDays === undefined) {
    return likesCount;
  }

  if (timeDecayDays <= 0) {
    return likesCount;
  }

  const now = new Date();

  return likes.reduce((score, like) => {
    const likeDate = new Date(like.createdAt as any);
    if (Number.isNaN(likeDate.getTime())) {
      return score + 1;
    }

    const likeAgeInDays =
      (now.getTime() - likeDate.getTime()) / (1000 * 60 * 60 * 24);

    return score + Math.exp(-likeAgeInDays / timeDecayDays);
  }, 0);
}

// Alias with the same name used in client code
export function calculateProjectScore(
  project: Trendable,
  options: { timeDecayDays?: number } = {}
): number {
  return calculateTrendingScore(project, options);
}
