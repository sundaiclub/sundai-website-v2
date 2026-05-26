import { POST as POST_CHAPTER_ADMIN } from '../../src/app/api/chapters/[chapterId]/admins/route';
import { DELETE as DELETE_CHAPTER_ADMIN } from '../../src/app/api/chapters/[chapterId]/admins/[hackerId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminMembership,
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
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
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
    $transaction: jest.fn(),
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
    if (where?.id) {
      return memberships.find((membership) => membership.id === where.id) ?? null;
    }

    const compound = where?.chapterId_hackerId;
    const chapterId = compound?.chapterId ?? where?.chapterId;
    const hackerId = compound?.hackerId ?? where?.hackerId;
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
  prisma.chapterMembership.findUnique.mockImplementation(async (args: any) =>
    findMembership(args)
  );
};

const membershipFromResponse = (body: any) => body.membership ?? body;

describe('/api/chapters/[chapterId]/admins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.$transaction.mockImplementation(async (operation: any) => {
      if (typeof operation === 'function') return operation(prisma);
      return Promise.all(operation);
    });
  });

  it('assigns an active chapter admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });
    const targetHacker = buildHacker({
      id: 'hacker-new-admin',
      clerkId: 'clerk-new-admin',
      name: 'New Chapter Admin',
      username: 'newchapteradmin',
      email: 'new-admin@example.com',
    });
    const existingMembership = buildChapterMembership({
      id: 'membership-new-admin',
      chapterId: chapter.id,
      hackerId: targetHacker.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    const promotedMembership = buildChapterAdminMembership({
      id: existingMembership.id,
      chapterId: chapter.id,
      hackerId: targetHacker.id,
    });

    mockActor(siteAdmin, targetHacker);
    mockMembershipLookup(existingMembership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapterMembership.create.mockResolvedValue(promotedMembership);
    prisma.chapterMembership.update.mockResolvedValue(promotedMembership);
    prisma.chapterMembership.upsert.mockResolvedValue(promotedMembership);

    const response = await POST_CHAPTER_ADMIN(
      createJsonRequest('/api/chapters/chapter-boston/admins', {
        method: 'POST',
        body: { hackerId: targetHacker.id },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();
    const membership = membershipFromResponse(body);

    expect(response.status).toBe(201);
    expect(membership).toMatchObject({
      chapterId: chapter.id,
      hackerId: targetHacker.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    expect(
      prisma.chapterMembership.upsert.mock.calls.length +
        prisma.chapterMembership.update.mock.calls.length +
        prisma.chapterMembership.create.mock.calls.length
    ).toBeGreaterThan(0);
  });

  it('rejects removing the only active chapter admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });
    const onlyAdmin = buildHacker({
      id: 'hacker-only-admin',
      clerkId: 'clerk-only-admin',
      name: 'Only Chapter Admin',
      username: 'onlyadmin',
      email: 'only-admin@example.com',
    });
    const onlyAdminMembership = buildChapterAdminMembership({
      id: 'membership-only-admin',
      chapterId: chapter.id,
      hackerId: onlyAdmin.id,
    });

    mockActor(siteAdmin, onlyAdmin);
    mockMembershipLookup(onlyAdminMembership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapterMembership.count.mockResolvedValue(1);

    const response = await DELETE_CHAPTER_ADMIN(
      createJsonRequest(
        '/api/chapters/chapter-boston/admins/hacker-only-admin',
        { method: 'DELETE' }
      ) as any,
      createRouteContext({
        chapterId: chapter.id,
        hackerId: onlyAdmin.id,
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body).toLowerCase()).toContain('active admin');
    expect(prisma.chapterMembership.update).not.toHaveBeenCalled();
  });
});
