import { GET as GET_EVENTS, POST as POST_EVENTS } from '../../src/app/api/events/route';
import {
  createJsonRequest,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  type ChapterMembershipFixture,
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
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
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

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  const findMembership = ({ where }: any) => {
    const chapterId = where?.chapterId;
    const hackerId = where?.hackerId;
    const role = typeof where?.role === 'string' ? where.role : undefined;
    const status = typeof where?.status === 'string' ? where.status : undefined;

    return (
      memberships.find((membership) => {
        if (chapterId && membership.chapterId !== chapterId) return false;
        if (hackerId && membership.hackerId !== hackerId) return false;
        if (role && membership.role !== role) return false;
        if (status && membership.status !== status) return false;
        return true;
      }) ?? null
    );
  };

  prisma.chapterMembership.findFirst.mockImplementation(async (args: any) =>
    findMembership(args)
  );
  prisma.chapterMembership.findMany.mockImplementation(async ({ where }: any) =>
    memberships.filter((membership) => {
      if (where?.hackerId && membership.hackerId !== where.hackerId) {
        return false;
      }
      if (where?.role && membership.role !== where.role) {
        return false;
      }
      if (where?.status && membership.status !== where.status) {
        return false;
      }
      return true;
    })
  );
};

describe('/api/events organizer chapter-admin behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('allows a chapter admin to create an event in their chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const startTime = '2026-06-10T22:00:00.000Z';
    const createdEvent = {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      chapterId: chapter.id,
      slug: 'boston-demo-night',
      startTime: new Date(startTime),
      createdById: hacker.id,
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.event.create.mockResolvedValue(createdEvent);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: {
          title: 'Boston Demo Night',
          description: 'Local chapter showcase',
          chapterId: chapter.id,
          slug: 'boston-demo-night',
          startTime,
          location: 'Sundai Boston HQ',
          meetingUrl: 'https://meet.example.com/boston-demo-night',
          audienceCanReorder: false,
        },
      }) as any
    );
    const body = await response.json();

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Boston Demo Night',
          chapterId: chapter.id,
          slug: 'boston-demo-night',
          createdById: hacker.id,
          location: 'Sundai Boston HQ',
          meetingUrl: 'https://meet.example.com/boston-demo-night',
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: createdEvent.id }));
  });

  it('denies chapter admins creating events for another chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(otherChapter);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: {
          title: 'NYC Demo Night',
          chapterId: otherChapter.id,
          startTime: '2026-06-17T22:00:00.000Z',
        },
      }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: otherChapter.id,
          hackerId: hacker.id,
        }),
      })
    );
    expect(chapter.id).not.toBe(otherChapter.id);
  });

  it('filters organizer event lists to chapters the chapter admin manages', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const bostonEvent = {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      chapterId: chapter.id,
      startTime: new Date('2026-06-10T22:00:00.000Z'),
    };
    const nycEvent = {
      id: 'event-nyc-demo-night',
      title: 'NYC Demo Night',
      chapterId: otherChapter.id,
      startTime: new Date('2026-06-17T22:00:00.000Z'),
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.event.findMany.mockImplementation(async (args: any = {}) => {
      const chapterId = args.where?.chapterId;
      if (chapterId === chapter.id || chapterId?.in?.includes(chapter.id)) {
        return [bostonEvent];
      }

      return [bostonEvent, nycEvent];
    });

    const response = await GET_EVENTS(
      createJsonRequest('/api/events', {
        searchParams: { organizer: true },
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: bostonEvent.id,
        chapterId: chapter.id,
      }),
    ]);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: expect.anything(),
        }),
      })
    );
  });
});
