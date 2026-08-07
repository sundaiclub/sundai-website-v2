import {
  EventDateTimeInputError,
  parseEventDateTimeInput,
} from '../../src/lib/eventDateTime';

describe('event datetime parsing', () => {
  it('interprets a wall-clock event time in its IANA timezone', () => {
    expect(
      parseEventDateTimeInput(
        '2026-07-10T13:00',
        'America/New_York',
        'startTime'
      ).toISOString()
    ).toBe('2026-07-10T17:00:00.000Z');
  });

  it('uses the correct standard-time offset for the event date', () => {
    expect(
      parseEventDateTimeInput(
        '2026-01-10T13:00',
        'America/New_York',
        'startTime'
      ).toISOString()
    ).toBe('2026-01-10T18:00:00.000Z');
  });

  it('preserves an instant that already has an explicit offset', () => {
    expect(
      parseEventDateTimeInput(
        '2026-07-10T17:00:00.000Z',
        undefined,
        'startTime'
      ).toISOString()
    ).toBe('2026-07-10T17:00:00.000Z');
  });

  it('rejects a local time skipped by daylight-saving time', () => {
    expect(() =>
      parseEventDateTimeInput(
        '2026-03-08T02:30',
        'America/New_York',
        'startTime'
      )
    ).toThrow(EventDateTimeInputError);
  });
});
