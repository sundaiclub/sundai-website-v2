import { PATCH as PATCH_CHAPTER } from '../../src/app/api/chapters/[chapterId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildChapterMembership,
  buildHacker,
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
      update: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
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

const loadChapterInvitesRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/invites/route');
  } catch (error) {
    throw new Error(
      `Expected POST /api/chapters/[chapterId]/invites route for T044. ${String(
        error
      )}`
    );
  }
};

const loadChapterMembershipRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/members/[membershipId]/route');
  } catch (error) {
    throw new Error(
      `Expected PATCH /api/chapters/[chapterId]/members/[membershipId] route for T044. ${String(
        error
      )}`
    );
  }
};

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

describe('chapter-admin scoped chapter operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.$transaction.mockImplementation(async (operation: any) => {
      if (typeof operation === 'function') return operation(prisma);
      return Array.isArray(operation) ? Promise.all(operation) : operation;
    });
  });

  it('allows a chapter admin to update settings for their own chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const updatedChapter = buildChapter({
      ...chapter,
      name: 'Sundai Greater Boston',
      defaultDeclineMessage:
        'Thanks for applying. Please try a future Boston event.',
      mailingListName: 'boston-organizers',
    });

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapter.update.mockResolvedValue(updatedChapter);

    const response = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: {
          name: updatedChapter.name,
          defaultDeclineMessage: updatedChapter.defaultDeclineMessage,
          mailingListName: updatedChapter.mailingListName,
        },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: expect.objectContaining({
          name: 'Sundai Greater Boston',
          defaultDeclineMessage:
            'Thanks for applying. Please try a future Boston event.',
          mailingListName: 'boston-organizers',
        }),
      })
    );
    expect(body).toMatchObject({
      id: chapter.id,
      name: 'Sundai Greater Boston',
      defaultDeclineMessage:
        'Thanks for applying. Please try a future Boston event.',
    });
  });

  it('allows a chapter admin to invite a hacker to their private chapter', async () => {
    const { POST } = loadChapterInvitesRoute();
    const { chapter, hacker, membership } = buildChapterAdminFixture({
      chapter: { accessMode: 'PRIVATE' },
    });
    const invitedHacker = buildHacker({
      id: 'hacker-private-invitee',
      clerkId: 'clerk-private-invitee',
      name: 'Private Invitee',
      username: 'privateinvitee',
      email: 'invitee@example.com',
    });
    const invitedMembership = buildChapterMembership({
      id: 'membership-private-invitee',
      chapterId: chapter.id,
      hackerId: invitedHacker.id,
      role: 'MEMBER',
      status: 'INVITED',
      invitedById: hacker.id,
      invitedAt: new Date('2026-05-25T12:00:00.000Z'),
      joinedAt: null,
    });

    mockActor(hacker, invitedHacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapterMembership.create.mockResolvedValue(invitedMembership);
    prisma.chapterMembership.upsert.mockResolvedValue(invitedMembership);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-boston/invites', {
        method: 'POST',
        body: { hackerId: invitedHacker.id },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      chapterId: chapter.id,
      hackerId: invitedHacker.id,
      role: 'MEMBER',
      status: 'INVITED',
      invitedById: hacker.id,
    });
    expect(
      prisma.chapterMembership.upsert.mock.calls.length +
        prisma.chapterMembership.create.mock.calls.length
    ).toBeGreaterThan(0);
  });

  it('allows a chapter admin to revoke a member in their chapter', async () => {
    const { PATCH } = loadChapterMembershipRoute();
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const targetMembership = buildChapterMembership({
      id: 'membership-target-member',
      chapterId: chapter.id,
      hackerId: 'hacker-target-member',
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    const revokedMembership = {
      ...targetMembership,
      status: 'REVOKED',
      revokedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    mockActor(hacker);
    mockMembershipLookup(membership, targetMembership);
    prisma.chapterMembership.update.mockResolvedValue(revokedMembership);

    const response = await PATCH(
      createJsonRequest(
        '/api/chapters/chapter-boston/members/membership-target-member',
        {
          method: 'PATCH',
          body: { status: 'REVOKED' },
        }
      ) as any,
      createRouteContext({
        chapterId: chapter.id,
        membershipId: targetMembership.id,
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetMembership.id },
        data: expect.objectContaining({ status: 'REVOKED' }),
      })
    );
    expect(body).toMatchObject({
      id: targetMembership.id,
      chapterId: chapter.id,
      status: 'REVOKED',
    });
  });

  it('denies chapter admins from mutating another chapter', async () => {
    const { POST } = loadChapterInvitesRoute();
    const { PATCH } = loadChapterMembershipRoute();
    const { hacker, membership: bostonAdminMembership } =
      buildChapterAdminFixture();
    const nycChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
      accessMode: 'PRIVATE',
    });
    const nycMember = buildChapterMembership({
      id: 'membership-nyc-member',
      chapterId: nycChapter.id,
      hackerId: 'hacker-nyc-member',
    });
    const invitedHacker = buildHacker({
      id: 'hacker-cross-chapter-invitee',
      clerkId: 'clerk-cross-chapter-invitee',
      email: 'cross-chapter@example.com',
    });

    mockActor(hacker, invitedHacker);
    mockMembershipLookup(bostonAdminMembership, nycMember);
    prisma.chapter.findUnique.mockResolvedValue(nycChapter);

    const settingsResponse = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-nyc', {
        method: 'PATCH',
        body: { name: 'Unauthorized NYC Edit' },
      }) as any,
      createRouteContext({ chapterId: nycChapter.id }) as any
    );
    const inviteResponse = await POST(
      createJsonRequest('/api/chapters/chapter-nyc/invites', {
        method: 'POST',
        body: { hackerId: invitedHacker.id },
      }) as any,
      createRouteContext({ chapterId: nycChapter.id }) as any
    );
    const memberResponse = await PATCH(
      createJsonRequest(
        '/api/chapters/chapter-nyc/members/membership-nyc-member',
        {
          method: 'PATCH',
          body: { status: 'REVOKED' },
        }
      ) as any,
      createRouteContext({
        chapterId: nycChapter.id,
        membershipId: nycMember.id,
      }) as any
    );

    expect(settingsResponse.status).toBe(403);
    expect(inviteResponse.status).toBe(403);
    expect(memberResponse.status).toBe(403);
    expect(prisma.chapter.update).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.create).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.upsert).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.update).not.toHaveBeenCalled();
  });
});
