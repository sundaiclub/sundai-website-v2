export function reconcileVoteDeckIds(
  previousDeckIds: string[],
  eligibleProjectIds: string[],
  seenProjectIds: ReadonlySet<string>
) {
  const eligibleProjectIdSet = new Set(eligibleProjectIds);
  const nextDeckIds = previousDeckIds.filter(
    (projectId) => eligibleProjectIdSet.has(projectId) && !seenProjectIds.has(projectId)
  );
  const nextDeckIdSet = new Set(nextDeckIds);

  for (const projectId of eligibleProjectIds) {
    if (seenProjectIds.has(projectId) || nextDeckIdSet.has(projectId)) continue;
    nextDeckIds.push(projectId);
    nextDeckIdSet.add(projectId);
  }

  return nextDeckIds;
}
