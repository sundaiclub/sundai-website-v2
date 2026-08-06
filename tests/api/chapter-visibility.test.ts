import { GET as GET_CHAPTERS } from '../../src/app/api/chapters/route';
import { GET as GET_CHAPTER } from '../../src/app/api/chapters/[chapterId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterMembership,
  buildNativeEventRsvpFixture,
  buildPublishedEvent,
  buildUnpublishedEvent,
  buildHacker,
  buildSiteAdmin,
  type ChapterFixture,
  type ChapterMembershipFixture,
  type EventFixture,
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
    },
    chapter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;

const mockHackerLookup = (...hackers: HackerFixture[]) => {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        (hacker) => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
};

const mockActor = (actor: HackerFixture, ...extraHackers: HackerFixture[]) => {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockCurrentUser({
    id: actor.clerkId,
    primaryEmailAddress: actor.email
      ? { id: `${actor.id}-email`, emailAddress: actor.email }
      : null,
  });
  mockHackerLookup(actor, ...extraHackers);
};

const matchesStatus = (actual: unknown, expected: string) => {
  if (!actual) return true;
  if (typeof actual === 'string') return actual === expected;
  if (typeof actual === 'object' && actual !== null && 'in' in actual) {
    return Array.isArray((actual as { in?: unknown }).in)
      ? ((actual as { in: unknown[] }).in as unknown[]).includes(expected)
      : false;
  }
  return false;
};

const matchesScalarFilter = <T,>(value: T, filter: T | { in?: T[] }) => {
  if (filter && typeof filter === 'object' && 'in' in filter) {
    return filter.in?.includes(value) ?? false;
  }

  return value === filter;
};

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  prisma.chapterMembership.findFirst.mockImplementation(async ({ where }: any) => {
    return (
      memberships.find((membership) => {
        if (where?.chapterId && membership.chapterId !== where.chapterId) {
          return false;
        }
        if (where?.hackerId && membership.hackerId !== where.hackerId) {
          return false;
        }
        if (where?.role && membership.role !== where.role) return false;
        return matchesStatus(where?.status, membership.status);
      }) ?? null
    );
  });
};

const matchesMembershipWhere = (
  membership: ChapterMembershipFixture,
  where: any = {}
) => {
  if (where.chapterId && membership.chapterId !== where.chapterId) return false;
  if (where.hackerId && membership.hackerId !== where.hackerId) return false;
  if (where.role && membership.role !== where.role) return false;
  if (where.status && !matchesScalarFilter(membership.status, where.status)) {
    return false;
  }
  return true;
};

const chapterHasMatchingMembership = (
  chapter: ChapterFixture,
  memberships: ChapterMembershipFixture[],
  where: any = {}
) =>
  memberships.some(
    (membership) =>
      membership.chapterId === chapter.id && matchesMembershipWhere(membership, where)
  );

const matchesChapterWhere = (
  chapter: ChapterFixture,
  where: any = {},
  memberships: ChapterMembershipFixture[] = []
): boolean => {
  if (!where) return true;
  if (where.AND) {
    return where.AND.every((clause: any) =>
      matchesChapterWhere(chapter, clause, memberships)
    );
  }
  if (where.OR) {
    return where.OR.some((clause: any) =>
      matchesChapterWhere(chapter, clause, memberships)
    );
  }
  if (where.id && !matchesScalarFilter(chapter.id, where.id)) return false;
  if (where.slug && !matchesScalarFilter(chapter.slug, where.slug)) return false;
  if (where.status && !matchesScalarFilter(chapter.status, where.status)) {
    return false;
  }
  if (
    where.accessMode &&
    !matchesScalarFilter(chapter.accessMode, where.accessMode)
  ) {
    return false;
  }
  if (
    where.memberships?.some &&
    !chapterHasMatchingMembership(chapter, memberships, where.memberships.some)
  ) {
    return false;
  }
  return true;
};

const matchesEventWhere = (event: EventFixture, where: any = {}) => {
  if (!where) return true;
  if (where.status && !matchesScalarFilter(event.status, where.status)) {
    return false;
  }
  if (
    where.visibility &&
    !matchesScalarFilter(event.visibility, where.visibility)
  ) {
    return false;
  }
  if (where.startTime?.gte && event.startTime < where.startTime.gte) {
    return false;
  }
  if (where.startTime?.lt && event.startTime >= where.startTime.lt) {
    return false;
  }
  return true;
};

const selectEventSummary = (event: EventFixture, select: any = {}) => {
  if (!select || Object.keys(select).length === 0) return event;

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, event[key as keyof EventFixture]])
  );
};

const mockChapterDirectoryDatabase = ({
  chapters,
  memberships = [],
  events = [],
}: {
  chapters: ChapterFixture[];
  memberships?: ChapterMembershipFixture[];
  events?: EventFixture[];
}) => {
  prisma.chapter.findMany.mockImplementation(async (args: any = {}) => {
    const result = chapters
      .filter((chapter) => matchesChapterWhere(chapter, args.where, memberships))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((chapter) => {
        const record: Record<string, unknown> = { ...chapter };

        if (args.include?.memberships) {
          const membershipWhere = args.include.memberships.where ?? {};
          const take = args.include.memberships.take;
          const matchingMemberships = memberships.filter(
            (membership) =>
              membership.chapterId === chapter.id &&
              matchesMembershipWhere(membership, membershipWhere)
          );
          record.memberships = take
            ? matchingMemberships.slice(0, take)
            : matchingMemberships;
        }

        if (args.include?.events) {
          const eventArgs = args.include.events;
          const matchingEvents = events
            .filter(
              (event) =>
                event.chapterId === chapter.id &&
                matchesEventWhere(event, eventArgs.where)
            )
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          const limitedEvents = eventArgs.take
            ? matchingEvents.slice(0, eventArgs.take)
            : matchingEvents;
          record.events = limitedEvents.map((event) =>
            selectEventSummary(event, eventArgs.select)
          );
        }

        return record;
      });

    return result;
  });
};

describe('chapter visibility API', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.event.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists active public chapters for signed-out users', async () => {
    const publicChapter = buildChapter({ id: 'chapter-boston' });

    mockSignedOutClerk();
    prisma.chapter.findMany.mockResolvedValue([publicChapter]);

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: publicChapter.id,
        accessMode: 'PUBLIC',
        status: 'ACTIVE',
      }),
    ]);
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', accessMode: 'PUBLIC' },
      })
    );
  });

  it('filters the public chapter directory to active public chapters', async () => {
    const activePublicChapter = buildChapter({
      id: 'chapter-boston',
      name: 'Sundai Boston',
      accessMode: 'PUBLIC',
      status: 'ACTIVE',
    });
    const pausedPublicChapter = buildChapter({
      id: 'chapter-paused',
      name: 'Sundai Paused',
      slug: 'paused',
      accessMode: 'PUBLIC',
      status: 'PAUSED',
    });
    const activePrivateChapter = buildChapter({
      id: 'chapter-private',
      name: 'Sundai Private',
      slug: 'private',
      accessMode: 'PRIVATE',
      status: 'ACTIVE',
    });

    mockSignedOutClerk();
    mockChapterDirectoryDatabase({
      chapters: [activePublicChapter, pausedPublicChapter, activePrivateChapter],
    });

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((chapter: any) => chapter.id)).toEqual([
      activePublicChapter.id,
    ]);
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', accessMode: 'PUBLIC' },
      })
    );
  });

  it('includes the next published public event summary for public chapter cards', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const nextPublishedEvent = buildPublishedEvent({
      id: 'event-boston-next-build-night',
      chapterId: fixture.publicChapter.id,
      title: 'Next Build Night',
      slug: 'next-build-night',
      startTime: new Date('2026-08-01T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const laterPublishedEvent = buildPublishedEvent({
      id: 'event-boston-later-build-night',
      chapterId: fixture.publicChapter.id,
      title: 'Later Build Night',
      slug: 'later-build-night',
      startTime: new Date('2026-08-08T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const unpublishedEvent = buildUnpublishedEvent({
      id: 'event-boston-secret-draft',
      chapterId: fixture.publicChapter.id,
      title: 'Secret Draft Night',
      slug: 'secret-draft-night',
      startTime: new Date('2026-07-30T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const privateEvent = buildPublishedEvent({
      id: 'event-boston-private-salon',
      chapterId: fixture.publicChapter.id,
      title: 'Private Salon',
      slug: 'private-salon',
      visibility: 'PRIVATE',
      startTime: new Date('2026-07-29T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });

    mockSignedOutClerk();
    mockChapterDirectoryDatabase({
      chapters: [fixture.publicChapter],
      events: [
        privateEvent,
        unpublishedEvent,
        laterPublishedEvent,
        nextPublishedEvent,
      ],
    });

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: fixture.publicChapter.id,
        nextEvent: expect.objectContaining({
          id: nextPublishedEvent.id,
          title: nextPublishedEvent.title,
          slug: nextPublishedEvent.slug,
          publicLocation: nextPublishedEvent.publicLocation,
        }),
      }),
    ]);
    expect(body[0].nextEvent).not.toHaveProperty('status');
    expect(body[0].nextEvent).not.toHaveProperty('visibility');
    expect(body[0].nextEvent).not.toHaveProperty('approvedDetailsJson');
    expect(body[0].nextEvent).not.toHaveProperty('meetingUrl');
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          events: expect.objectContaining({
            where: expect.objectContaining({
              status: 'PUBLISHED',
              visibility: 'PUBLIC',
              startTime: { gte: expect.any(Date) },
            }),
            orderBy: { startTime: 'asc' },
            take: 1,
            select: expect.objectContaining({
              id: true,
              title: true,
              slug: true,
              startTime: true,
              publicLocation: true,
            }),
          }),
        }),
      })
    );
  });

  it('lists public chapters and invited private chapters for a signed-in hacker', async () => {
    const hacker = buildHacker();
    const publicChapter = buildChapter({ id: 'chapter-boston' });
    const privateChapter = buildChapter({
      id: 'chapter-private',
      name: 'Sundai Private',
      slug: 'private',
      accessMode: 'PRIVATE',
    });
    const invitedMembership = buildChapterMembership({
      id: 'membership-private-invite',
      chapterId: privateChapter.id,
      hackerId: hacker.id,
      status: 'INVITED',
      joinedAt: null,
      invitedAt: new Date('2026-05-25T12:00:00.000Z'),
    });

    mockActor(hacker);
    prisma.chapter.findMany.mockResolvedValue([
      publicChapter,
      { ...privateChapter, memberships: [invitedMembership] },
    ]);

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: publicChapter.id, accessMode: 'PUBLIC' }),
        expect.objectContaining({
          id: privateChapter.id,
          accessMode: 'PRIVATE',
          memberships: [
            expect.objectContaining({
              hackerId: hacker.id,
              status: 'INVITED',
            }),
          ],
        }),
      ])
    );
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: 'ACTIVE',
              accessMode: 'PUBLIC',
            }),
            expect.objectContaining({
              status: 'ACTIVE',
              accessMode: 'PRIVATE',
              memberships: expect.objectContaining({
                some: expect.objectContaining({
                  hackerId: hacker.id,
                  status: { in: ['INVITED', 'ACTIVE'] },
                }),
              }),
            }),
          ]),
        }),
        include: expect.objectContaining({
          memberships: {
            where: { hackerId: hacker.id },
            take: 1,
          },
        }),
      })
    );
  });

  it('does not list private chapters for signed-in hackers without a visible membership', async () => {
    const hacker = buildHacker({
      id: 'hacker-outsider',
      clerkId: 'clerk-outsider',
    });
    const publicChapter = buildChapter({ id: 'chapter-boston' });
    const privateChapter = buildChapter({
      id: 'chapter-private',
      name: 'Sundai Private',
      slug: 'private',
      accessMode: 'PRIVATE',
    });

    mockActor(hacker);
    mockChapterDirectoryDatabase({
      chapters: [publicChapter, privateChapter],
      memberships: [],
    });

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((chapter: any) => chapter.id)).toEqual([publicChapter.id]);
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: 'ACTIVE',
              accessMode: 'PUBLIC',
            }),
            expect.objectContaining({
              status: 'ACTIVE',
              accessMode: 'PRIVATE',
              memberships: expect.objectContaining({
                some: expect.objectContaining({
                  hackerId: hacker.id,
                  status: { in: ['INVITED', 'ACTIVE'] },
                }),
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('lists all chapters for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const privatePausedChapter = buildChapter({
      id: 'chapter-private-paused',
      name: 'Sundai Private Paused',
      slug: 'private-paused',
      status: 'PAUSED',
      accessMode: 'PRIVATE',
    });

    mockActor(siteAdmin);
    prisma.chapter.findMany.mockResolvedValue([privatePausedChapter]);

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: privatePausedChapter.id,
        status: 'PAUSED',
        accessMode: 'PRIVATE',
      }),
    ]);
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('returns public chapter details to signed-out users', async () => {
    const publicChapter = buildChapter({ id: 'chapter-boston' });

    mockSignedOutClerk();
    prisma.chapter.findUnique.mockImplementation(async ({ include, select }: any) => {
      if (select) return publicChapter;
      if (include) return { ...publicChapter, memberships: [] };
      return publicChapter;
    });

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston') as any,
      createRouteContext({ chapterId: publicChapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: publicChapter.id,
      accessMode: 'PUBLIC',
      status: 'ACTIVE',
    });
  });

  it('returns public chapter details when addressed by slug', async () => {
    const publicChapter = buildChapter({ id: 'chapter-boston', slug: 'boston' });

    mockSignedOutClerk();
    prisma.chapter.findUnique.mockImplementation(async ({ where, include, select }: any) => {
      if (where?.id === publicChapter.id) {
        if (select) return publicChapter;
        if (include) return { ...publicChapter, memberships: [], events: [] };
        return publicChapter;
      }
      if (where?.slug === publicChapter.slug) {
        return { id: publicChapter.id };
      }
      return null;
    });

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: publicChapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: publicChapter.id,
      slug: publicChapter.slug,
    });
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: publicChapter.slug },
      })
    );
  });

  it('returns upcoming and previous published public event summaries on chapter details', async () => {
    const publicChapter = buildChapter({ id: 'chapter-boston', slug: 'boston' });
    const publishedFutureEvent = buildPublishedEvent({
      id: 'event-boston-next-build-night',
      chapterId: publicChapter.id,
      title: 'Next Build Night',
      slug: 'next-build-night',
      startTime: new Date('2026-08-01T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const unpublishedFutureEvent = buildUnpublishedEvent({
      id: 'event-boston-secret-draft',
      chapterId: publicChapter.id,
      title: 'Secret Draft Night',
      slug: 'secret-draft-night',
      startTime: new Date('2026-07-30T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const privateFutureEvent = buildPublishedEvent({
      id: 'event-boston-private-salon',
      chapterId: publicChapter.id,
      title: 'Private Salon',
      slug: 'private-salon',
      visibility: 'PRIVATE',
      startTime: new Date('2026-07-29T22:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const pastPublishedEvent = buildPublishedEvent({
      id: 'event-boston-past-night',
      chapterId: publicChapter.id,
      title: 'Past Build Night',
      slug: 'past-build-night',
      startTime: new Date('2026-05-01T22:00:00.000Z'),
      endTime: new Date('2026-05-02T01:00:00.000Z'),
      publicLocation: 'Boston, MA',
    });
    const events = [
      privateFutureEvent,
      unpublishedFutureEvent,
      pastPublishedEvent,
      publishedFutureEvent,
    ];

    mockSignedOutClerk();
    prisma.chapter.findUnique.mockImplementation(
      async ({ where, include, select }: any) => {
        const matchesChapter =
          where?.id === publicChapter.id || where?.slug === publicChapter.slug;
        if (!matchesChapter) return null;

        if (select) {
          return Object.fromEntries(
            Object.entries(select)
              .filter(([, enabled]) => enabled)
              .map(([key]) => [key, publicChapter[key as keyof ChapterFixture]])
          );
        }

        if (include) {
          const eventArgs = include.events ?? {};
          const upcomingEvents = events
            .filter((event) => matchesEventWhere(event, eventArgs.where))
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
            .map((event) => selectEventSummary(event, eventArgs.select));

          return {
            ...publicChapter,
            memberships: [],
            events: upcomingEvents,
          };
        }

        return publicChapter;
      }
    );
    prisma.event.findMany.mockImplementation(
      async ({ where, orderBy, select }: any) => {
        const matchingEvents = events
          .filter((event) => matchesEventWhere(event, where))
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        if (orderBy?.startTime === 'desc') matchingEvents.reverse();
        return matchingEvents.map((event) => selectEventSummary(event, select));
      }
    );

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: publicChapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.upcomingEvents).toEqual([
      expect.objectContaining({
        id: publishedFutureEvent.id,
        title: publishedFutureEvent.title,
        slug: publishedFutureEvent.slug,
        publicLocation: publishedFutureEvent.publicLocation,
      }),
    ]);
    expect(body.upcomingEvents.map((event: any) => event.id)).not.toContain(
      unpublishedFutureEvent.id
    );
    expect(body.upcomingEvents.map((event: any) => event.id)).not.toContain(
      privateFutureEvent.id
    );
    expect(body.upcomingEvents.map((event: any) => event.id)).not.toContain(
      pastPublishedEvent.id
    );
    expect(body.previousEvents).toEqual([
      expect.objectContaining({
        id: pastPublishedEvent.id,
        title: pastPublishedEvent.title,
        slug: pastPublishedEvent.slug,
        publicLocation: pastPublishedEvent.publicLocation,
      }),
    ]);
    expect(body.previousEvents[0]).not.toHaveProperty('status');
    expect(body.previousEvents[0]).not.toHaveProperty('visibility');
    expect(body.upcomingEvents[0]).not.toHaveProperty('status');
    expect(body.upcomingEvents[0]).not.toHaveProperty('visibility');
    expect(body.upcomingEvents[0]).not.toHaveProperty('approvedDetailsJson');
    expect(body.upcomingEvents[0]).not.toHaveProperty('meetingUrl');
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          events: expect.objectContaining({
            where: expect.objectContaining({
              status: 'PUBLISHED',
              visibility: 'PUBLIC',
              startTime: { gte: expect.any(Date) },
            }),
            select: expect.objectContaining({
              id: true,
              title: true,
              slug: true,
              startTime: true,
              publicLocation: true,
            }),
          }),
        }),
      })
    );
  });

  it('does not include pending event summaries for regular chapter members', async () => {
    const hacker = buildHacker({
      id: 'hacker-member',
      clerkId: 'clerk-member',
    });
    const publicChapter = buildChapter({
      id: 'chapter-boston',
      slug: 'boston',
    });
    const activeMembership = buildChapterMembership({
      chapterId: publicChapter.id,
      hackerId: hacker.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    mockActor(hacker);
    mockMembershipLookup(activeMembership);
    prisma.chapter.findUnique.mockImplementation(
      async ({ where, include, select }: any) => {
        const matchesChapter =
          where?.id === publicChapter.id || where?.slug === publicChapter.slug;
        if (!matchesChapter) return null;

        if (select) {
          return Object.fromEntries(
            Object.entries(select)
              .filter(([, enabled]) => enabled)
              .map(([key]) => [key, publicChapter[key as keyof ChapterFixture]])
          );
        }

        if (include) {
          return { ...publicChapter, memberships: [], events: [] };
        }

        return publicChapter;
      }
    );

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: publicChapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty('pendingEvents');
    expect(prisma.event.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.event.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it('returns private chapter details to invited hackers', async () => {
    const hacker = buildHacker();
    const privateChapter = buildChapter({
      id: 'chapter-private',
      accessMode: 'PRIVATE',
    });
    const invitedMembership = buildChapterMembership({
      chapterId: privateChapter.id,
      hackerId: hacker.id,
      status: 'INVITED',
      joinedAt: null,
    });

    mockActor(hacker);
    mockMembershipLookup(invitedMembership);
    prisma.chapter.findUnique.mockImplementation(async ({ include, select }: any) => {
      if (select) return privateChapter;
      if (include) return { ...privateChapter, memberships: [] };
      return privateChapter;
    });

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/chapter-private') as any,
      createRouteContext({ chapterId: privateChapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: privateChapter.id,
      accessMode: 'PRIVATE',
    });
  });

  it('hides private chapter details from non-invited hackers', async () => {
    const hacker = buildHacker({ id: 'hacker-outsider', clerkId: 'clerk-outsider' });
    const privateChapter = buildChapter({
      id: 'chapter-private',
      accessMode: 'PRIVATE',
    });

    mockActor(hacker);
    prisma.chapter.findUnique.mockImplementation(async ({ include, select }: any) => {
      if (select) return privateChapter;
      if (include) return { ...privateChapter, memberships: [] };
      return privateChapter;
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/chapter-private') as any,
      createRouteContext({ chapterId: privateChapter.id }) as any
    );

    expect(response.status).toBe(404);
    expect(prisma.chapter.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
      })
    );
  });
});
