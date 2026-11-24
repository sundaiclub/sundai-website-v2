import {
  buildEventEngagementReport,
  type EventEngagementQueryRow,
} from '@/lib/eventEngagement';

const now = new Date('2026-11-24T12:00:00Z');

function row(
  overrides: Partial<EventEngagementQueryRow>
): EventEngagementQueryRow {
  return {
    eventId: 'event',
    title: 'Hack',
    startTime: new Date('2026-11-01T15:00:00Z'),
    chapterId: 'boston',
    chapterName: 'Sundai Boston',
    rsvps: 100,
    projects: 10,
    presented: 8,
    rsvpBuilders: 20,
    ...overrides,
  };
}

describe('buildEventEngagementReport', () => {
  it('groups hacks by chapter and ranks them by the share of RSVPs who built', () => {
    const report = buildEventEngagementReport(
      [
        row({ eventId: 'low', rsvps: 100, rsvpBuilders: 10 }),
        row({ eventId: 'high', rsvps: 50, rsvpBuilders: 20 }),
        row({
          eventId: 'sf',
          chapterId: 'sf',
          chapterName: 'Sundai San Francisco',
          rsvps: 40,
          rsvpBuilders: 36,
        }),
      ],
      now
    );

    expect(report.chapters.map(chapter => chapter.chapterId)).toEqual([
      'boston',
      'sf',
    ]);
    const boston = report.chapters[0];
    expect(boston.events.map(event => [event.eventId, event.rank])).toEqual([
      ['high', 1],
      ['low', 2],
    ]);
    expect(boston.events[0].builtRate).toBeCloseTo(0.4);
    expect(boston.rsvps).toBe(150);
    expect(boston.rsvpBuilders).toBe(30);
    expect(boston.builtRate).toBeCloseTo(0.2);
    expect(boston.rankedEvents).toBe(2);
  });

  it('leaves out hacks with fewer than 30 RSVPs', () => {
    const report = buildEventEngagementReport(
      [
        row({ eventId: 'small', rsvps: 29, rsvpBuilders: 29 }),
        row({ eventId: 'enough', rsvps: 30, rsvpBuilders: 3 }),
        row({
          eventId: 'small-chapter',
          chapterId: 'sf',
          chapterName: 'Sundai San Francisco',
          rsvps: 12,
        }),
      ],
      now
    );

    expect(report.minRsvps).toBe(30);
    expect(report.chapters).toHaveLength(1);
    expect(report.chapters[0].events.map(event => event.eventId)).toEqual([
      'enough',
    ]);
    expect(report.chapters[0].rsvps).toBe(30);
  });

  it('flags hacks that started in the past seven days', () => {
    const report = buildEventEngagementReport(
      [
        row({ eventId: 'recent', startTime: new Date('2026-11-22T15:00:00Z') }),
        row({
          eventId: 'boundary',
          startTime: new Date('2026-11-17T12:00:00Z'),
        }),
        row({ eventId: 'old', startTime: new Date('2026-11-15T15:00:00Z') }),
      ],
      now
    );

    const flags = Object.fromEntries(
      report.chapters[0].events.map(event => [event.eventId, event.isLastWeek])
    );
    expect(flags).toEqual({ recent: true, boundary: true, old: false });
    expect(report.lastWeekStart).toBe('2026-11-17T12:00:00.000Z');
  });

  it('leaves hacks without projects on the site unranked and out of chapter totals', () => {
    const report = buildEventEngagementReport(
      [
        row({ eventId: 'external', rsvps: 1000, projects: 0, rsvpBuilders: 0 }),
        row({ eventId: 'ranked', rsvps: 40, rsvpBuilders: 10 }),
      ],
      now
    );

    const [chapter] = report.chapters;
    expect(chapter.events.map(event => [event.eventId, event.rank])).toEqual([
      ['ranked', 1],
      ['external', null],
    ]);
    expect(chapter.events[1].builtRate).toBeNull();
    expect(chapter.rsvps).toBe(40);
    expect(chapter.builtRate).toBeCloseTo(0.25);
    expect(chapter.rankedEvents).toBe(1);
  });
});
