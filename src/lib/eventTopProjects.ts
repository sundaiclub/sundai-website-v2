const TOP_PROJECT_COUNT = 5;

type RankablePitchProject = {
  id: string;
  createdAt: string | Date;
  pitchVotes: Array<{ value?: string }>;
};

function getPitchProjectLikeCount(project: RankablePitchProject) {
  return project.pitchVotes.filter((vote) => vote.value === "LIKE").length;
}

function comparePitchProjectsByVotingResult(
  a: RankablePitchProject,
  b: RankablePitchProject
) {
  const likeDiff = getPitchProjectLikeCount(b) - getPitchProjectLikeCount(a);
  if (likeDiff !== 0) return likeDiff;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function rankPitchProjectsForPitching<T extends RankablePitchProject>(
  pitchProjects: T[]
) {
  return [...pitchProjects].sort(comparePitchProjectsByVotingResult);
}

export function getFrozenTopProjectIds<T extends RankablePitchProject>(
  sortedProjects: T[],
  topCount: number = TOP_PROJECT_COUNT
) {
  if (topCount <= 0) {
    return new Set<string>();
  }

  if (sortedProjects.length < topCount) {
    return new Set<string>();
  }

  const cutoffLikes = getPitchProjectLikeCount(sortedProjects[topCount - 1]);
  const tiedTopProjects = sortedProjects.filter(
    (project) => getPitchProjectLikeCount(project) >= cutoffLikes
  );

  return new Set(tiedTopProjects.map(project => project.id));
}
