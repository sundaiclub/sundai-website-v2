import { defaultVotingEndTime } from '@/lib/eventPitchTiming';

describe('defaultVotingEndTime', () => {
  it('defaults to 15 minutes into the final two hours of an event', () => {
    expect(
      defaultVotingEndTime(
        new Date('2026-08-30T18:00:00.000Z'),
        new Date('2026-08-31T02:00:00.000Z')
      ).toISOString()
    ).toBe('2026-08-31T00:15:00.000Z');
  });

  it('falls back to 15 minutes after the start when there is no end time', () => {
    expect(
      defaultVotingEndTime(new Date('2026-08-30T18:00:00.000Z')).toISOString()
    ).toBe('2026-08-30T18:15:00.000Z');
  });
});
