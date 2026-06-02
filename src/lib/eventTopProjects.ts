const TOP_PROJECT_COUNT = 5;

type RankableEventProject = {
  id: string;
  createdAt: string | Date;
  pitchVotes: Array<{ value?: string }>;
};

function getEventProjectLikeCount(project: RankableEventProject) {
  return project.pitchVotes.filter((vote) => vote.value === "LIKE").length;
}

function compareEventProjectsByVotingResult(
  a: RankableEventProject,
  b: RankableEventProject
) {
  const likeDiff = getEventProjectLikeCount(b) - getEventProjectLikeCount(a);
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

  const cutoffLikes = getEventProjectLikeCount(sortedProjects[topCount - 1]);
  const tiedTopProjects = sortedProjects.filter(
    (project) => getEventProjectLikeCount(project) >= cutoffLikes
  );

  return new Set(tiedTopProjects.map(project => project.id));
}
