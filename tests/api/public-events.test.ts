import { GET as GET_EVENTS } from '../../src/app/api/events/route';
import { GET as GET_EVENT } from '../../src/app/api/events/[eventId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildNativeEventRsvpFixture,
  buildPublishedEvent,
  type ChapterFixture,
  type ChapterMembershipFixture,
  type EventFixture,
  type EventRegistrationFixture,
  type EventStaffFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    chapter: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    eventRegistration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;

type EventRecord = EventFixture & {
  chapter: ChapterFixture;
  _count: { registrations: number };
};

const now = new Date('2026-06-23T12:00:00.000Z');

function withChapter(
  event: EventFixture,
  chapter: ChapterFixture
): EventRecord {
  return {
    ...event,
    chapter,
    _count: { registrations: 1 },
  };
}

function matchesScalarFilter<T>(value: T, filter: T | { in?: T[] }) {
  if (filter && typeof filter === 'object' && 'in' in filter) {
    return filter.in?.includes(value) ?? false;
  }

  return value === filter;
}

function matchesEventWhere(event: EventRecord, where: any = {}) {
  if (!where) return true;
  if (where.id && event.id !== where.id) return false;
  if (where.slug && event.slug !== where.slug) return false;
  if (where.status && !matchesScalarFilter(event.status, where.status)) {
    return false;
  }
  if (
    where.visibility &&
    !matchesScalarFilter(event.visibility, where.visibility)
  ) {
    return false;
  }
  if (
    where.chapterId &&
    !matchesScalarFilter(event.chapterId, where.chapterId)
  ) {
    return false;
  }
  if (where.startTime?.gte && event.startTime < where.startTime.gte) {
    return false;
  }
  if (where.chapter) {
    if (
      where.chapter.slug &&
      !matchesScalarFilter(event.chapter.slug, where.chapter.slug)
    ) {
      return false;
    }
    if (
      where.chapter.status &&
      !matchesScalarFilter(event.chapter.status, where.chapter.status)
    ) {
      return false;
    }
    if (
      where.chapter.accessMode &&
      !matchesScalarFilter(event.chapter.accessMode, where.chapter.accessMode)
    ) {
      return false;
    }
  }

  return true;
}

function mockPublicEventDatabase({
  events,
  registrations = [],
  hackers = [],
  memberships = [],
  staff = [],
}: {
  events: EventRecord[];
  registrations?: EventRegistrationFixture[];
  hackers?: HackerFixture[];
  memberships?: ChapterMembershipFixture[];
  staff?: EventStaffFixture[];
}) {
  prisma.event.findMany.mockImplementation(async (args: any = {}) => {
    const result = events.filter(event => matchesEventWhere(event, args.where));
    const orderBy = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
    if (orderBy.some(order => order?.startTime === 'asc')) {
      result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    if (orderBy.some(order => order?.startTime === 'desc')) {
      result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }
    return result.slice(
      args.skip ?? 0,
      args.take ? (args.skip ?? 0) + args.take : undefined
    );
  });

  const findEvent = (args: any = {}) =>
    events.find(event => matchesEventWhere(event, args.where)) ?? null;

  prisma.event.findFirst.mockImplementation(async (args: any = {}) =>
    findEvent(args)
  );
  prisma.event.findUnique.mockImplementation(
    async (args: any = {}) =>
      events.find(event => event.id === args.where?.id) ?? null
  );
  prisma.eventRegistration.findMany.mockImplementation(async (args: any = {}) =>
    registrations.filter(registration => {
      const where = args.where ?? {};
      if (
        where.eventId?.in &&
        !where.eventId.in.includes(registration.eventId)
      ) {
        return false;
      }
      if (
        where.eventId &&
        typeof where.eventId === 'string' &&
        registration.eventId !== where.eventId
      ) {
        return false;
      }
      if (where.hackerId && registration.hackerId !== where.hackerId) {
        return false;
      }
      return true;
    })
  );
  prisma.eventRegistration.findFirst.mockImplementation(
    async (args: any = {}) => {
      const where = args.where ?? {};
      return (
        registrations.find(registration => {
          if (where.eventId && registration.eventId !== where.eventId)
            return false;
          if (where.hackerId && registration.hackerId !== where.hackerId)
            return false;
          return true;
        }) ?? null
      );
    }
  );
  prisma.hacker.findUnique.mockImplementation(async (args: any = {}) => {
    const where = args.where ?? {};
    return (
      hackers.find(
        hacker => hacker.id === where.id || hacker.clerkId === where.clerkId
      ) ?? null
    );
  });
  prisma.hacker.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args.where ?? {};
    return (
      hackers.find(
        hacker => hacker.id === where.id || hacker.clerkId === where.clerkId
      ) ?? null
    );
  });
  prisma.chapterMembership.findMany.mockImplementation(async (args: any = {}) =>
    memberships.filter(membership => {
      const where = args.where ?? {};
      if (where.hackerId && membership.hackerId !== where.hackerId)
        return false;
      if (where.chapterId && membership.chapterId !== where.chapterId) {
        return false;
      }
      if (where.role && membership.role !== where.role) return false;
      if (where.status && membership.status !== where.status) return false;
      return true;
    })
  );
  prisma.chapterMembership.findFirst.mockImplementation(
    async (args: any = {}) => {
      const where = args.where ?? {};
      return (
        memberships.find(membership => {
          if (where.hackerId && membership.hackerId !== where.hackerId)
            return false;
          if (where.chapterId && membership.chapterId !== where.chapterId) {
            return false;
          }
          if (where.role && membership.role !== where.role) return false;
          if (where.status && membership.status !== where.status) return false;
          return true;
        }) ?? null
      );
    }
  );
  prisma.eventStaff.findFirst.mockImplementation(async (args: any = {}) => {
    const where = args.where ?? {};
    return (
      staff.find(assignment => {
        if (where.eventId && assignment.eventId !== where.eventId) return false;
        if (where.hackerId && assignment.hackerId !== where.hackerId) {
          return false;
        }
        if (where.role?.in && !where.role.in.includes(assignment.role)) {
          return false;
        }
        if (typeof where.role === 'string' && assignment.role !== where.role) {
          return false;
        }
        return true;
      }) ?? null
    );
  });
}

function expectPublicEventCardShape(card: any) {
  expect(card).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      slug: expect.any(String),
      chapter: expect.objectContaining({
        id: expect.any(String),
        slug: expect.any(String),
        name: expect.any(String),
        timezone: expect.any(String),
      }),
      title: expect.any(String),
      publicLocation: expect.any(String),
      startTime: expect.any(String),
      publicStatus: expect.any(String),
    })
  );
  expect(card).not.toHaveProperty('approvedDetailsJson');
  expect(card).not.toHaveProperty('address');
  expect(card).not.toHaveProperty('virtualUrl');
  expect(card).not.toHaveProperty('meetingUrl');
  expect(card).not.toHaveProperty('staff');
  expect(card).not.toHaveProperty('pitchSessions');
}

describe('GET /api/events public listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns only upcoming published public events in active public chapters', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const nycEvent = buildPublishedEvent({
      id: 'event-nyc-demo-night',
      chapterId: otherChapter.id,
      title: 'NYC Demo Night',
      slug: 'nyc-demo-night',
      publicLocation: 'New York, NY',
      startTime: new Date('2026-07-12T22:00:00.000Z'),
    });
    const pastEvent = buildPublishedEvent({
      id: 'event-boston-past-build-night',
      chapterId: fixture.publicChapter.id,
      title: 'Past Build Night',
      slug: 'past-build-night',
      startTime: new Date('2026-05-10T22:00:00.000Z'),
    });

    mockSignedOutClerk();
    mockPublicEventDatabase({
      events: [
        withChapter(fixture.publishedEvent, fixture.publicChapter),
        withChapter(fixture.unpublishedEvent, fixture.publicChapter),
        withChapter(fixture.privateChapterEvent, fixture.privateChapter),
        withChapter(nycEvent, otherChapter),
        withChapter(pastEvent, fixture.publicChapter),
      ],
    });

    const response = await GET_EVENTS(createJsonRequest('/api/events') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((event: any) => event.id)).toEqual([
      fixture.publishedEvent.id,
      nycEvent.id,
    ]);
    body.forEach(expectPublicEventCardShape);
  });

  it('filters public listings by chapter slug', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const nycEvent = buildPublishedEvent({
      id: 'event-nyc-demo-night',
      chapterId: otherChapter.id,
      title: 'NYC Demo Night',
      slug: 'nyc-demo-night',
      publicLocation: 'New York, NY',
    });

    mockSignedOutClerk();
    mockPublicEventDatabase({
      events: [
        withChapter(fixture.publishedEvent, fixture.publicChapter),
        withChapter(nycEvent, otherChapter),
      ],
    });

    const response = await GET_EVENTS(
      createJsonRequest('/api/events', {
        searchParams: { chapterSlug: fixture.publicChapter.slug },
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: fixture.publishedEvent.id,
        chapter: expect.objectContaining({
          slug: fixture.publicChapter.slug,
        }),
      })
    );
  });

  it('includes signed-in viewer registration status without exposing registration internals', async () => {
    const fixture = buildNativeEventRsvpFixture();

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockPublicEventDatabase({
      events: [withChapter(fixture.publishedEvent, fixture.publicChapter)],
      registrations: [fixture.pendingRegistration],
      hackers: [fixture.applicant],
    });

    const response = await GET_EVENTS(createJsonRequest('/api/events') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: fixture.publishedEvent.id,
        viewerRegistrationStatus: 'PENDING',
      }),
    ]);
    expect(body[0]).not.toHaveProperty('viewerRegistration');
    expect(body[0]).not.toHaveProperty('answersJson');
    expect(body[0]).not.toHaveProperty('internalReviewNotes');
  });
});

describe('GET /api/events/[eventId] public detail redaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    {
      label: 'anonymous viewers',
      authenticate: (
        fixture: ReturnType<typeof buildNativeEventRsvpFixture>
      ) => {
        mockSignedOutClerk();
        return {
          hackers: [],
          registrations: [fixture.pendingRegistration],
          memberships: [],
          staff: [],
          approvedVisible: false,
          viewerRegistrationStatus: undefined,
        };
      },
    },
    {
      label: 'pending viewers',
      authenticate: (
        fixture: ReturnType<typeof buildNativeEventRsvpFixture>
      ) => {
        mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
        return {
          hackers: [fixture.applicant],
          registrations: [fixture.pendingRegistration],
          memberships: [],
          staff: [],
          approvedVisible: false,
          viewerRegistrationStatus: 'PENDING',
        };
      },
    },
    {
      label: 'approved viewers',
      authenticate: (
        fixture: ReturnType<typeof buildNativeEventRsvpFixture>
      ) => {
        mockAuthenticatedClerk({ userId: fixture.approvedApplicant.clerkId });
        return {
          hackers: [fixture.approvedApplicant],
          registrations: [fixture.approvedRegistration],
          memberships: [],
          staff: [],
          approvedVisible: true,
          viewerRegistrationStatus: 'APPROVED',
        };
      },
    },
    {
      label: 'organizer viewers',
      authenticate: (
        fixture: ReturnType<typeof buildNativeEventRsvpFixture>
      ) => {
        mockAuthenticatedClerk({ userId: fixture.mc.hacker.clerkId });
        return {
          hackers: [fixture.mc.hacker],
          registrations: [],
          memberships: [],
          staff: [fixture.mc.staff],
          approvedVisible: true,
          viewerRegistrationStatus: undefined,
        };
      },
    },
  ])('redacts approved-only details for $label', async ({ authenticate }) => {
    const fixture = buildNativeEventRsvpFixture();
    const authContext = authenticate(fixture);

    mockPublicEventDatabase({
      events: [withChapter(fixture.publishedEvent, fixture.publicChapter)],
      registrations: authContext.registrations,
      hackers: authContext.hackers,
      memberships: authContext.memberships,
      staff: authContext.staff,
    });

    const response = await GET_EVENT(
      createJsonRequest(`/api/events/${fixture.publishedEvent.id}`) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        id: fixture.publishedEvent.id,
        title: fixture.publishedEvent.title,
        description: fixture.publishedEvent.description,
        publicLocation: fixture.publishedEvent.publicLocation,
        approvedDetailsVisible: authContext.approvedVisible,
      })
    );
    expect(body.viewerRegistration?.status).toBe(
      authContext.viewerRegistrationStatus
    );

    if (authContext.approvedVisible) {
      expect(body.approvedDetailsJson).toEqual(
        fixture.publishedEvent.approvedDetailsJson
      );
    } else {
      expect(body.approvedDetailsJson).toBeNull();
      expect(JSON.stringify(body)).not.toContain('123 Builder Lane');
      expect(JSON.stringify(body)).not.toContain('side entrance');
      expect(JSON.stringify(body)).not.toContain('toolkit');
    }

    expect(body).not.toHaveProperty('address');
    expect(body).not.toHaveProperty('virtualUrl');
    expect(body).not.toHaveProperty('meetingUrl');
    expect(body).not.toHaveProperty('internalReviewNotes');
  });

  it('allows chapter organizers to see approved-only details by id', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const chapterAdmin = buildChapterAdminFixture({
      chapter: fixture.publicChapter,
      membership: {
        chapterId: fixture.publicChapter.id,
      },
    });

    mockAuthenticatedClerk({ userId: chapterAdmin.hacker.clerkId });
    mockPublicEventDatabase({
      events: [withChapter(fixture.publishedEvent, fixture.publicChapter)],
      hackers: [chapterAdmin.hacker],
      memberships: [chapterAdmin.membership],
    });

    const response = await GET_EVENT(
      createJsonRequest(`/api/events/${fixture.publishedEvent.id}`) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.approvedDetailsVisible).toBe(true);
    expect(body.approvedDetailsJson).toEqual(
      fixture.publishedEvent.approvedDetailsJson
    );
  });
});
