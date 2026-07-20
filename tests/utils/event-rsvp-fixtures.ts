type FixtureOverrides<T> = Partial<T>;

type ChapterTimezoneFixture = {
  id: string;
  name: string;
  slug: string;
  city: string;
  timezone: string;
};

type EventDateTimeFixture = {
  id: string;
  slug: string;
  title: string;
  chapter: ChapterTimezoneFixture;
  publicLocation: string;
  startTime: string;
  endTime: string;
};

type CalendarPayloadExpectation = {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

type CalendarPayloadFixture = {
  event: EventDateTimeFixture;
  publicDescription: string;
  approvedOnlyDescription: string;
  publicPayload: CalendarPayloadExpectation;
  approvedPayload: CalendarPayloadExpectation;
};

type CalendarPayloadFixtureOverrides = Omit<
  FixtureOverrides<CalendarPayloadFixture>,
  'publicPayload' | 'approvedPayload'
> & {
  publicPayload?: FixtureOverrides<CalendarPayloadExpectation>;
  approvedPayload?: FixtureOverrides<CalendarPayloadExpectation>;
};

const bostonChapterTimezoneFixture: ChapterTimezoneFixture = {
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  timezone: 'America/New_York',
};

const buildEventDateTimeFixture = (
  overrides: FixtureOverrides<EventDateTimeFixture> = {}
): EventDateTimeFixture => ({
  id: 'event-boston-ai-build-night',
  slug: 'ai-build-night',
  title: 'AI Build Night',
  chapter: bostonChapterTimezoneFixture,
  publicLocation: 'Boston, MA',
  startTime: '2026-07-10T22:00:00.000Z',
  endTime: '2026-07-11T01:00:00.000Z',
  ...overrides,
});

const buildCalendarPayloadFixture = (
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
