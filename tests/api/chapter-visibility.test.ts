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
  buildHacker,
  buildSiteAdmin,
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
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
    },
    event: {
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

describe('chapter visibility API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
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
        include: {
          memberships: {
            where: { hackerId: hacker.id },
            take: 1,
          },
        },
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
