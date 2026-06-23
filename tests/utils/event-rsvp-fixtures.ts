export type FixtureOverrides<T> = Partial<T>;

export type ChapterTimezoneFixture = {
  id: string;
  name: string;
  slug: string;
  city: string;
  timezone: string;
};

export type EventDateTimeFixture = {
  id: string;
  slug: string;
  title: string;
  chapter: ChapterTimezoneFixture;
  publicLocation: string;
  startTime: string;
  endTime: string;
  expectedChapterDate: string;
  expectedChapterTimeRange: string;
  expectedChapterDateTimeRange: string;
  expectedUtcCalendarRange: string;
};

export type CalendarPayloadExpectation = {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

export type CalendarPayloadFixture = {
  event: EventDateTimeFixture;
  publicDescription: string;
  approvedOnlyDescription: string;
  publicPayload: CalendarPayloadExpectation;
  approvedPayload: CalendarPayloadExpectation;
};

export type CalendarPayloadFixtureOverrides = Omit<
  FixtureOverrides<CalendarPayloadFixture>,
  'publicPayload' | 'approvedPayload'
> & {
  publicPayload?: FixtureOverrides<CalendarPayloadExpectation>;
  approvedPayload?: FixtureOverrides<CalendarPayloadExpectation>;
};

export const bostonChapterTimezoneFixture: ChapterTimezoneFixture = {
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  timezone: 'America/New_York',
};

export const chicagoChapterTimezoneFixture: ChapterTimezoneFixture = {
  id: 'chapter-chicago',
  name: 'Sundai Chicago',
  slug: 'chicago',
  city: 'Chicago',
  timezone: 'America/Chicago',
};

export const losAngelesChapterTimezoneFixture: ChapterTimezoneFixture = {
  id: 'chapter-los-angeles',
  name: 'Sundai Los Angeles',
  slug: 'los-angeles',
  city: 'Los Angeles',
  timezone: 'America/Los_Angeles',
};

export const buildEventDateTimeFixture = (
  overrides: FixtureOverrides<EventDateTimeFixture> = {}
): EventDateTimeFixture => ({
  id: 'event-boston-ai-build-night',
  slug: 'ai-build-night',
  title: 'AI Build Night',
  chapter: bostonChapterTimezoneFixture,
  publicLocation: 'Boston, MA',
  startTime: '2026-07-10T22:00:00.000Z',
  endTime: '2026-07-11T01:00:00.000Z',
  expectedChapterDate: 'Friday, July 10, 2026',
  expectedChapterTimeRange: '6:00 PM - 9:00 PM EDT',
  expectedChapterDateTimeRange: 'Friday, July 10, 2026, 6:00 PM - 9:00 PM EDT',
  expectedUtcCalendarRange: '20260710T220000Z/20260711T010000Z',
  ...overrides,
});

export const chapterTimezoneDateTimeFixtures: EventDateTimeFixture[] = [
  buildEventDateTimeFixture(),
  buildEventDateTimeFixture({
    id: 'event-chicago-winter-showcase',
    slug: 'winter-showcase',
    title: 'Winter Showcase',
    chapter: chicagoChapterTimezoneFixture,
    publicLocation: 'Chicago, IL',
    startTime: '2026-12-05T20:30:00.000Z',
    endTime: '2026-12-05T23:00:00.000Z',
    expectedChapterDate: 'Saturday, December 5, 2026',
    expectedChapterTimeRange: '2:30 PM - 5:00 PM CST',
    expectedChapterDateTimeRange: 'Saturday, December 5, 2026, 2:30 PM - 5:00 PM CST',
    expectedUtcCalendarRange: '20261205T203000Z/20261205T230000Z',
  }),
  buildEventDateTimeFixture({
    id: 'event-los-angeles-date-boundary',
    slug: 'date-boundary-lab',
    title: 'Date Boundary Lab',
    chapter: losAngelesChapterTimezoneFixture,
    publicLocation: 'Los Angeles, CA',
    startTime: '2026-07-11T01:00:00.000Z',
    endTime: '2026-07-11T03:30:00.000Z',
    expectedChapterDate: 'Friday, July 10, 2026',
    expectedChapterTimeRange: '6:00 PM - 8:30 PM PDT',
    expectedChapterDateTimeRange: 'Friday, July 10, 2026, 6:00 PM - 8:30 PM PDT',
    expectedUtcCalendarRange: '20260711T010000Z/20260711T033000Z',
  }),
];

export const buildCalendarPayloadFixture = (
  overrides: CalendarPayloadFixtureOverrides = {}
): CalendarPayloadFixture => {
  const event = overrides.event ?? buildEventDateTimeFixture();
  const publicDescription =
    overrides.publicDescription ??
    'Bring a laptop and a project idea for a hands-on Sundai build session.';
  const approvedOnlyDescription =
    overrides.approvedOnlyDescription ??
    'Approved attendees should enter through the side door and check in with the host.';

  return {
    event,
    publicDescription,
    approvedOnlyDescription,
    publicPayload: {
      title: event.title,
      description: publicDescription,
      location: event.publicLocation,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.chapter.timezone,
      ...overrides.publicPayload,
    },
    approvedPayload: {
      title: event.title,
      description: `${publicDescription}\n\n${approvedOnlyDescription}`,
      location: event.publicLocation,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.chapter.timezone,
      ...overrides.approvedPayload,
    },
  };
};

export const publicCalendarPayloadFixture = buildCalendarPayloadFixture();

export const approvedCalendarPayloadFixture = buildCalendarPayloadFixture({
  event: buildEventDateTimeFixture({
    id: 'event-boston-approved-calendar',
    slug: 'approved-calendar-night',
    title: 'Approved Calendar Night',
  }),
});
