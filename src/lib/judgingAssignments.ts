/** A deterministic minimum-cost flow: coverage first, total load second,
 * then load within each track. No judge has a workload cap. */
export function allocateJudgingAssignments(
  projects: Array<{ id: string; trackId: string }>,
  judges: Array<{ id: string; trackIds: string[] }>,
  judgesPerProject: number
): Array<{ judgeId: string; submissionId: string }> {
  if (!Number.isSafeInteger(judgesPerProject) || judgesPerProject < 1) {
    throw new Error('Judges per project must be a positive whole number.');
  }
  type Edge = { to: number; reverse: number; capacity: number; cost: number };
  const graph: Edge[][] = [[], []];
  const source = 0;
  const sink = 1;
  const node = () => graph.push([]) - 1;
  const edge = (from: number, to: number, capacity: number, cost = 0) => {
    const forward = { to, reverse: graph[to].length, capacity, cost };
    graph[from].push(forward);
    graph[to].push({
      to: from,
      reverse: graph[from].length - 1,
      capacity: 0,
      cost: -cost,
    });
    return forward;
  };
  const orderedProjects = [...projects].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const orderedJudges = [...judges].sort((a, b) => a.id.localeCompare(b.id));
  const trackCounts = new Map<string, number>();
  for (const project of projects) {
    trackCounts.set(
      project.trackId,
      (trackCounts.get(project.trackId) ?? 0) + 1
    );
  }
  // Larger than any possible change in the sum of squared track loads.
  const maxAssignments =
    projects.length * Math.min(judgesPerProject, judges.length);
  const totalWeight = maxAssignments ** 2 + 1;
  const judgeTracks = new Map<string, Map<string, number>>();
  for (const judge of orderedJudges) {
    const judgeNode = node();
    const tracks = new Map<string, number>();
    judgeTracks.set(judge.id, tracks);
    let eligibleCount = 0;
    for (const trackId of Array.from(new Set(judge.trackIds)).sort()) {
      const count = trackCounts.get(trackId) ?? 0;
      if (!count) continue;
      eligibleCount += count;
      const trackNode = node();
      tracks.set(trackId, trackNode);
      for (let load = 0; load < count; load += 1) {
        edge(trackNode, judgeNode, 1, 2 * load + 1);
      }
    }
    for (let load = 0; load < eligibleCount; load += 1) {
      edge(judgeNode, sink, 1, (2 * load + 1) * totalWeight);
    }
  }
  const candidates: Array<{
    judgeId: string;
    submissionId: string;
    edge: Edge;
  }> = [];
  for (const project of orderedProjects) {
    const projectNode = node();
    edge(source, projectNode, judgesPerProject);
    for (const judge of orderedJudges) {
      const trackNode = judgeTracks.get(judge.id)!.get(project.trackId);
      if (trackNode === undefined) continue;
      candidates.push({
        judgeId: judge.id,
        submissionId: project.id,
        edge: edge(projectNode, trackNode, 1),
      });
    }
  }

  // Successive shortest augmenting paths. Reverse edges allow earlier choices
  // to move, so a flexible judge cannot take capacity needed by another track.
  while (true) {
    const distance = Array<number>(graph.length).fill(Infinity);
    const previous = Array<{ from: number; index: number } | undefined>(
      graph.length
    );
    const queued = Array<boolean>(graph.length).fill(false);
    const queue = [source];
    distance[source] = 0;
    queued[source] = true;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const from = queue[cursor];
      queued[from] = false;
      graph[from].forEach((item, index) => {
        const next = distance[from] + item.cost;
        if (item.capacity === 0 || next >= distance[item.to]) return;
        distance[item.to] = next;
        previous[item.to] = { from, index };
        if (!queued[item.to]) {
          queue.push(item.to);
          queued[item.to] = true;
        }
      });
    }
    if (!previous[sink]) break;
    for (let to = sink; to !== source; ) {
      const { from, index } = previous[to]!;
      const item = graph[from][index];
      item.capacity -= 1;
      graph[to][item.reverse].capacity += 1;
      to = from;
    }
  }
  return candidates
    .filter(item => item.edge.capacity === 0)
    .map(({ judgeId, submissionId }) => ({ judgeId, submissionId }));
}

/** Hands each released project to the least-loaded eligible judge not already
 * on it, leaving every existing assignment in place so scoring in progress is
 * undisturbed. Projects nobody eligible can take are returned as uncovered. */
export function reassignJudgingAssignments(
  released: Array<{ id: string; trackId: string }>,
  judges: Array<{ id: string; trackIds: string[] }>,
  existing: Array<{ judgeId: string; submissionId: string }>
): {
  assignments: Array<{ judgeId: string; submissionId: string }>;
  uncovered: string[];
} {
  const load = new Map(judges.map(judge => [judge.id, 0]));
  const taken = new Set<string>();
  for (const item of existing) {
    taken.add(`${item.judgeId}:${item.submissionId}`);
    if (load.has(item.judgeId))
      load.set(item.judgeId, load.get(item.judgeId)! + 1);
  }
  const orderedJudges = [...judges].sort((a, b) => a.id.localeCompare(b.id));
  const assignments: Array<{ judgeId: string; submissionId: string }> = [];
  const uncovered: string[] = [];
  // Scarcest projects first so a flexible judge is not spent on an easy one.
  const eligibleFor = (project: { id: string; trackId: string }) =>
    orderedJudges.filter(
      judge =>
        judge.trackIds.includes(project.trackId) &&
        !taken.has(`${judge.id}:${project.id}`)
    );
  const ordered = [...released].sort(
    (a, b) =>
      eligibleFor(a).length - eligibleFor(b).length || a.id.localeCompare(b.id)
  );
  for (const project of ordered) {
    const judge = eligibleFor(project).reduce<
      (typeof orderedJudges)[number] | null
    >(
      (best, candidate) =>
        !best || load.get(candidate.id)! < load.get(best.id)!
          ? candidate
          : best,
      null
    );
    if (!judge) {
      uncovered.push(project.id);
      continue;
    }
    taken.add(`${judge.id}:${project.id}`);
    load.set(judge.id, load.get(judge.id)! + 1);
    assignments.push({ judgeId: judge.id, submissionId: project.id });
  }
  return { assignments, uncovered };
}
