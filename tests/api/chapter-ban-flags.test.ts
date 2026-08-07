import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapterAdminFixture,
  buildHacker,
  buildUserBanFlag,
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
    userBan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userBanFlag: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;
const {
  GET: GET_GLOBAL_BANS,
} = require('../../src/app/api/admin/bans/route');

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
  prisma.chapterMembership.findFirst.mockImplementation(async ({ where }: any) => {
    return (
      memberships.find((membership) => {
        if (where?.chapterId && membership.chapterId !== where.chapterId) {
          return false;
        }
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
      }) ?? null
    );
  });
};

const loadChapterBanFlagsRoute = () =>
  require('../../src/app/api/chapters/[chapterId]/ban-flags/route');

describe('/api/chapters/[chapterId]/ban-flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('allows a chapter admin to create a ban flag for site-admin review', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const flaggedHacker = buildHacker({
      id: 'hacker-flagged',
      clerkId: 'clerk-flagged',
      name: 'Flagged Hacker',
      email: 'flagged@example.com',
    });
    const createdFlag = buildUserBanFlag({
      id: 'flag-boston-review',
      chapterId: chapter.id,
      hackerId: flaggedHacker.id,
      createdById: hacker.id,
      reason: 'Repeated local code of conduct concern.',
    });
    const { POST: POST_CHAPTER_BAN_FLAG } = loadChapterBanFlagsRoute();

    mockActor(hacker, flaggedHacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.userBanFlag.create.mockResolvedValue(createdFlag);

    const response = await POST_CHAPTER_BAN_FLAG(
      createJsonRequest(`/api/chapters/${chapter.id}/ban-flags`, {
        method: 'POST',
        body: {
          hackerId: flaggedHacker.id,
          reason: 'Repeated local code of conduct concern.',
        },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(prisma.userBanFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: chapter.id,
          hackerId: flaggedHacker.id,
          createdById: hacker.id,
          reason: 'Repeated local code of conduct concern.',
          status: 'OPEN',
        }),
      })
    );
    expect(prisma.userBan.findMany).not.toHaveBeenCalled();
    expect(prisma.userBan.create).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        id: createdFlag.id,
        chapterId: chapter.id,
        hackerId: flaggedHacker.id,
        status: 'OPEN',
      })
    );
  });

  it('lists chapter ban flags through a chapter slug without exposing global bans', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const flaggedHacker = buildHacker({
      id: 'hacker-flagged',
      clerkId: 'clerk-flagged',
      name: 'Flagged Hacker',
      email: 'flagged@example.com',
    });
    const flag = {
      ...buildUserBanFlag({
        id: 'flag-boston-review',
        chapterId: chapter.id,
        hackerId: flaggedHacker.id,
        createdById: hacker.id,
        reason: 'Repeated local code of conduct concern.',
      }),
      hacker: {
        id: flaggedHacker.id,
        name: flaggedHacker.name,
        email: flaggedHacker.email,
      },
      createdBy: {
        id: hacker.id,
        name: hacker.name,
        email: hacker.email,
      },
      chapter: {
        id: chapter.id,
        name: chapter.name,
        slug: chapter.slug,
      },
      resolvedBy: null,
    };
    const { GET: GET_CHAPTER_BAN_FLAGS } = loadChapterBanFlagsRoute();

    mockActor(hacker, flaggedHacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockImplementation(async ({ where }: any) => {
      if (where?.id === chapter.id) return { id: chapter.id };
      if (where?.id === chapter.slug) return null;
      if (where?.slug === chapter.slug) return { id: chapter.id };
      return null;
    });
    prisma.userBanFlag.findMany.mockResolvedValue([flag]);

    const response = await GET_CHAPTER_BAN_FLAGS(
      createJsonRequest(`/api/chapters/${chapter.slug}/ban-flags`) as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.userBanFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chapterId: chapter.id },
      })
    );
    expect(prisma.userBan.findMany).not.toHaveBeenCalled();
    expect(body).toEqual([
      expect.objectContaining({
        id: flag.id,
        chapterId: chapter.id,
        hackerId: flaggedHacker.id,
        status: 'OPEN',
        hacker: expect.objectContaining({
          id: flaggedHacker.id,
          name: flaggedHacker.name,
        }),
      }),
    ]);
  });
});

describe('/api/admin/bans chapter-admin visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('denies global-ban visibility to chapter admins', async () => {
    const { hacker } = buildChapterAdminFixture();

    mockActor(hacker);

    const response = await GET_GLOBAL_BANS(
      createJsonRequest('/api/admin/bans') as any
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(prisma.userBan.findMany).not.toHaveBeenCalled();
    expect(body).toBe('Forbidden');
  });
});
