const VOTING_OFFSET_FROM_EVENT_END_MS = (2 * 60 - 15) * 60 * 1000;
const VOTING_OFFSET_FROM_EVENT_START_MS = 15 * 60 * 1000;

export function defaultVotingEndTime(
  startTime: Date,
  endTime?: Date | null
): Date {
  return endTime
    ? new Date(endTime.getTime() - VOTING_OFFSET_FROM_EVENT_END_MS)
    : new Date(startTime.getTime() + VOTING_OFFSET_FROM_EVENT_START_MS);
}
