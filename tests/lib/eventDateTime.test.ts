import {
  EventDateTimeInputError,
  formatEventSchedule,
  isMultiDayEvent,
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

describe('event schedule formatting', () => {
  const zone = 'America/New_York';
  // ICU separates some ranges with thin or narrow no-break spaces.
  const schedule = (...args: Parameters<typeof formatEventSchedule>) =>
    formatEventSchedule(...args).replace(/[\u00a0\u2009\u202f]/g, ' ');
  // Sat Sep 5, 2026, 6:00 PM - 9:00 PM EDT. The end is on the next UTC day.
  const eveningStart = '2026-09-05T22:00:00.000Z';
  const eveningEnd = '2026-09-06T01:00:00.000Z';
  // Sat Sep 5, 2026, 10:00 AM EDT - Mon Sep 7, 2026, 4:00 PM EDT.
  const weekendStart = '2026-09-05T14:00:00.000Z';
  const weekendEnd = '2026-09-07T20:00:00.000Z';

  it('shows a single-day event once with both times', () => {
    expect(schedule(eveningStart, eveningEnd, zone)).toBe(
      'Saturday, September 5, 2026, 6:00 PM – 9:00 PM'
    );
    expect(schedule(eveningStart, eveningEnd, zone, 'date')).toBe(
      'Sep 5, 2026'
    );
    expect(schedule(eveningStart, eveningEnd, zone, 'medium')).toBe(
      'Sep 5, 2026, 6:00 PM – 9:00 PM'
    );
    expect(schedule(eveningStart, eveningEnd, zone, 'short')).toBe(
      'Sat, Sep 5, 6:00 PM – 9:00 PM'
    );
    expect(schedule(eveningStart, eveningEnd, zone, 'time')).toBe(
      '6:00 PM – 9:00 PM'
    );
  });

  it('shows AM or PM on both times', () => {
    // Sat Sep 5, 2026, 6:00 AM - 9:00 PM EDT.
    expect(
      schedule('2026-09-05T10:00:00.000Z', eveningEnd, zone, 'time')
    ).toBe('6:00 AM – 9:00 PM');
    expect(schedule('2026-09-05T10:00:00.000Z', eveningEnd, zone)).toBe(
      'Saturday, September 5, 2026, 6:00 AM – 9:00 PM'
    );
  });

  it('shows both days for a multi-day event', () => {
    expect(schedule(weekendStart, weekendEnd, zone)).toBe(
      'Saturday, September 5, 2026 at 10:00 AM – Monday, September 7, 2026 at 4:00 PM'
    );
    expect(schedule(weekendStart, weekendEnd, zone, 'medium')).toBe(
      'Sep 5, 2026, 10:00 AM – Sep 7, 2026, 4:00 PM'
    );
    expect(schedule(weekendStart, weekendEnd, zone, 'date')).toBe(
      'Sep 5 – 7, 2026'
    );
  });

  it('includes the days when a time-only label spans more than one day', () => {
    expect(schedule(weekendStart, weekendEnd, zone, 'time')).toBe(
      'Sat, Sep 5, 10:00 AM – Mon, Sep 7, 4:00 PM'
    );
  });

  it('shows the end day for an overnight event', () => {
    // Sat 8:00 PM EDT - Sun 2:00 AM EDT.
    expect(
      schedule(
        '2026-09-06T00:00:00.000Z',
        '2026-09-06T06:00:00.000Z',
        zone,
        'short'
      )
    ).toBe('Sat, Sep 5, 8:00 PM – Sun, Sep 6, 2:00 AM');
  });

  it('formats each end of a range that crosses a daylight-saving change', () => {
    // Sat Oct 31, 2026, 10:00 AM EDT - Sun Nov 1, 2026, 6:00 PM EST.
    expect(
      schedule(
        parseEventDateTimeInput('2026-10-31T10:00', zone, 'startTime'),
        parseEventDateTimeInput('2026-11-01T18:00', zone, 'endTime'),
        zone,
        'medium'
      )
    ).toBe('Oct 31, 2026, 10:00 AM – Nov 1, 2026, 6:00 PM');
  });

  it('shows only the start when the end is missing or not after the start', () => {
    expect(schedule(eveningStart, null, zone)).toBe(
      'Saturday, September 5, 2026 at 6:00 PM'
    );
    expect(schedule(eveningStart, eveningStart, zone, 'date')).toBe(
      'Sep 5, 2026'
    );
  });

  it('decides whether an event spans days in the event timezone', () => {
    expect(isMultiDayEvent(eveningStart, eveningEnd, zone)).toBe(false);
    expect(isMultiDayEvent(eveningStart, eveningEnd, 'UTC')).toBe(true);
    expect(isMultiDayEvent(weekendStart, weekendEnd, zone)).toBe(true);
    expect(isMultiDayEvent(weekendStart, null, zone)).toBe(false);
  });
});
