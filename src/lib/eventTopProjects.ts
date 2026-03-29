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

export function getFrozenTopProjectIds<T extends { id: string }>(
  sortedProjects: T[],
  topCount: number = TOP_PROJECT_COUNT
) {
  if (sortedProjects.length < topCount) {
    return new Set<string>();
  }

  return new Set(sortedProjects.slice(0, topCount).map(project => project.id));
}
