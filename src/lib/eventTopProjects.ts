export const TOP_PROJECT_COUNT = 5;
export const DEFAULT_PRESENTING_SEC = 60;
export const DEFAULT_QUESTIONS_SEC = 120;
export const TOP_GROUP_PRESENTING_SEC = 120;
export const TOP_GROUP_QUESTIONS_SEC = 180;

type RankableEventProject = {
  id: string;
  createdAt: string | Date;
  project: {
    likes: Array<unknown>;
  };
};

export function compareEventProjectsByVotingResult(
  a: RankableEventProject,
  b: RankableEventProject
) {
  const likeDiff = b.project.likes.length - a.project.likes.length;
  if (likeDiff !== 0) return likeDiff;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function rankEventProjectsForPitching<T extends RankableEventProject>(
  eventProjects: T[]
) {
  return [...eventProjects].sort(compareEventProjectsByVotingResult);
}

export function getFrozenTopProjectIds<T extends RankableEventProject>(
  sortedProjects: T[],
  topCount: number = TOP_PROJECT_COUNT
) {
  if (topCount <= 0) {
    return new Set<string>();
  }

  if (sortedProjects.length < topCount) {
    return new Set<string>();
  }

  const cutoffLikes = sortedProjects[topCount - 1].project.likes.length;
  const tiedTopProjects = sortedProjects.filter(
    (project) => project.project.likes.length >= cutoffLikes
  );

  return new Set(tiedTopProjects.map(project => project.id));
}
