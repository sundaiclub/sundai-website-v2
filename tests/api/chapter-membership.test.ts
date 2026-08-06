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

const loadChapterJoinRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/join/route');
  } catch (error) {
    throw new Error(
      `Expected POST /api/chapters/[chapterId]/join route for T059. ${String(
        error
      )}`
    );
  }
};

const loadChapterLeaveRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/leave/route');
  } catch (error) {
    throw new Error(
      `Expected POST /api/chapters/[chapterId]/leave route for T059. ${String(
        error
      )}`
    );
  }
};

const loadChapterInviteAcceptRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/invites/accept/route');
  } catch (error) {
    throw new Error(
      `Expected POST /api/chapters/[chapterId]/invites/accept route for T059. ${String(
        error
      )}`
    );
  }
};

const loadChapterNotificationsRoute = () => {
  try {
    return require('../../src/app/api/chapters/[chapterId]/notifications/route');
  } catch (error) {
    throw new Error(
      `Expected PATCH /api/chapters/[chapterId]/notifications route for T059. ${String(
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

const findMembershipForWhere = (
  memberships: ChapterMembershipFixture[],
  where: any
) => {
  const compound = where?.chapterId_hackerId;
  const chapterId = compound?.chapterId ?? where?.chapterId;
  const hackerId = compound?.hackerId ?? where?.hackerId;

  return (
    memberships.find((membership) => {
      if (where?.id && membership.id !== where.id) return false;
      if (chapterId && membership.chapterId !== chapterId) return false;
      if (hackerId && membership.hackerId !== hackerId) return false;
      if (where?.role && membership.role !== where.role) return false;
      return matchesStatus(where?.status, membership.status);
    }) ?? null
  );
};

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  prisma.chapterMembership.findFirst.mockImplementation(async ({ where }: any) =>
    findMembershipForWhere(memberships, where)
  );
  prisma.chapterMembership.findUnique.mockImplementation(async ({ where }: any) =>
    findMembershipForWhere(memberships, where)
  );
};

describe('chapter membership API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.$transaction.mockImplementation(async (operation: any) => {
      if (typeof operation === 'function') return operation(prisma);
      return Array.isArray(operation) ? Promise.all(operation) : operation;
    });
  });

  it('requires authentication to join a public chapter', async () => {
    const { POST } = loadChapterJoinRoute();

    mockSignedOutClerk();

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-boston/join', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: 'chapter-boston' }) as any
    );

    expect(response.status).toBe(401);
    expect(prisma.chapterMembership.create).not.toHaveBeenCalled();
  });

  it('joins an active public chapter as the current hacker', async () => {
    const { POST } = loadChapterJoinRoute();
    const hacker = buildHacker();
    const chapter = buildChapter({ id: 'chapter-boston', accessMode: 'PUBLIC' });
    const createdMembership = buildChapterMembership({
      chapterId: chapter.id,
      hackerId: hacker.id,
      status: 'ACTIVE',
    });

    mockActor(hacker);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapterMembership.findUnique.mockResolvedValue(null);
    prisma.chapterMembership.create.mockResolvedValue(createdMembership);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-boston/join', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      chapterId: chapter.id,
      hackerId: hacker.id,
      role: 'MEMBER',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
    });
    expect(prisma.chapterMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: chapter.id,
          hackerId: hacker.id,
          role: 'MEMBER',
          status: 'ACTIVE',
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
        }),
      })
    );
  });

  it('rejects direct joins for private chapters', async () => {
    const { POST } = loadChapterJoinRoute();
    const hacker = buildHacker();
    const privateChapter = buildChapter({
      id: 'chapter-private',
      accessMode: 'PRIVATE',
    });

    mockActor(hacker);
    prisma.chapter.findUnique.mockResolvedValue(privateChapter);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-private/join', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: privateChapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain('active public chapters');
    expect(prisma.chapterMembership.create).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.update).not.toHaveBeenCalled();
  });

  it('accepts an active private chapter invitation', async () => {
    const { POST } = loadChapterInviteAcceptRoute();
    const hacker = buildHacker();
    const privateChapter = buildChapter({
      id: 'chapter-private',
      accessMode: 'PRIVATE',
    });
    const invitedMembership = buildChapterMembership({
      id: 'membership-private-invited',
      chapterId: privateChapter.id,
      hackerId: hacker.id,
      status: 'INVITED',
      joinedAt: null,
      invitedAt: new Date('2026-05-25T12:00:00.000Z'),
    });
    const activeMembership = {
      ...invitedMembership,
      status: 'ACTIVE',
      joinedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    mockActor(hacker);
    mockMembershipLookup(invitedMembership);
    prisma.chapter.findUnique.mockResolvedValue(privateChapter);
    prisma.chapterMembership.update.mockResolvedValue(activeMembership);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-private/invites/accept', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: privateChapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: invitedMembership.id,
      chapterId: privateChapter.id,
      hackerId: hacker.id,
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
    });
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invitedMembership.id },
        data: expect.objectContaining({
          status: 'ACTIVE',
          role: 'MEMBER',
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
        }),
      })
    );
  });

  it('rejects private invite acceptance without an active invitation', async () => {
    const { POST } = loadChapterInviteAcceptRoute();
    const hacker = buildHacker({ id: 'hacker-outsider', clerkId: 'clerk-outsider' });
    const privateChapter = buildChapter({
      id: 'chapter-private',
      accessMode: 'PRIVATE',
    });

    mockActor(hacker);
    prisma.chapter.findUnique.mockResolvedValue(privateChapter);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-private/invites/accept', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: privateChapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(JSON.stringify(body)).toContain('invitation');
    expect(prisma.chapterMembership.update).not.toHaveBeenCalled();
  });

  it('lets an active member leave a chapter and disables notifications', async () => {
    const { POST } = loadChapterLeaveRoute();
    const hacker = buildHacker();
    const activeMembership = buildChapterMembership({
      id: 'membership-active-member',
      chapterId: 'chapter-boston',
      hackerId: hacker.id,
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
    });
    const leftMembership = {
      ...activeMembership,
      status: 'LEFT',
      leftAt: new Date('2026-05-25T12:00:00.000Z'),
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
    };

    mockActor(hacker);
    mockMembershipLookup(activeMembership);
    prisma.chapterMembership.update.mockResolvedValue(leftMembership);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-boston/leave', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: activeMembership.chapterId }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: activeMembership.id,
      status: 'LEFT',
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
    });
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeMembership.id },
        data: expect.objectContaining({
          status: 'LEFT',
          notificationsAllowed: false,
          emailNotificationsEnabled: false,
          smsNotificationsEnabled: false,
        }),
      })
    );
  });

  it('rejects leaving when the hacker is the only active chapter admin', async () => {
    const { POST } = loadChapterLeaveRoute();
    const hacker = buildHacker({ id: 'hacker-admin', clerkId: 'clerk-admin' });
    const onlyAdminMembership = buildChapterMembership({
      id: 'membership-only-admin',
      chapterId: 'chapter-boston',
      hackerId: hacker.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    mockActor(hacker);
    mockMembershipLookup(onlyAdminMembership);
    prisma.chapterMembership.count.mockResolvedValue(1);

    const response = await POST(
      createJsonRequest('/api/chapters/chapter-boston/leave', {
        method: 'POST',
      }) as any,
      createRouteContext({ chapterId: onlyAdminMembership.chapterId }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body).toLowerCase()).toContain('only active chapter admin');
    expect(prisma.chapterMembership.update).not.toHaveBeenCalled();
  });

  it('updates notification preferences for the current active member', async () => {
    const { PATCH } = loadChapterNotificationsRoute();
    const hacker = buildHacker();
    const activeMembership = buildChapterMembership({
      id: 'membership-active-member',
      chapterId: 'chapter-boston',
      hackerId: hacker.id,
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
    });
    const updatedMembership = {
      ...activeMembership,
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
      notificationPreferencesJson: { productUpdates: false },
    };

    mockActor(hacker);
    mockMembershipLookup(activeMembership);
    prisma.chapterMembership.update.mockResolvedValue(updatedMembership);

    const response = await PATCH(
      createJsonRequest('/api/chapters/chapter-boston/notifications', {
        method: 'PATCH',
        body: {
          notificationsAllowed: false,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: true,
          notificationPreferencesJson: { productUpdates: false },
        },
      }) as any,
      createRouteContext({ chapterId: activeMembership.chapterId }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: activeMembership.id,
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
      notificationPreferencesJson: { productUpdates: false },
    });
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeMembership.id },
        data: expect.objectContaining({
          notificationsAllowed: false,
          emailNotificationsEnabled: false,
          smsNotificationsEnabled: false,
          notificationPreferencesJson: { productUpdates: false },
        }),
      })
    );
  });

  it('does not manage SMS consent through chapter preferences', async () => {
    const { PATCH } = loadChapterNotificationsRoute();
    const hacker = buildHacker();
    const activeMembership = buildChapterMembership({
      id: 'membership-sms-opt-in',
      chapterId: 'chapter-boston',
      hackerId: hacker.id,
      notificationsAllowed: true,
      smsNotificationsEnabled: false,
      smsConsentAt: null,
      smsConsentVersion: null,
    });
    const consentAt = new Date('2026-07-10T16:00:00.000Z');

    mockActor(hacker);
    mockMembershipLookup(activeMembership);
    prisma.chapterMembership.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...activeMembership,
        ...data,
        smsConsentAt: data.smsConsentAt ?? consentAt,
      })
    );

    const response = await PATCH(
      createJsonRequest('/api/chapters/chapter-boston/notifications', {
        method: 'PATCH',
        body: {
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: true,
          smsConsentGranted: true,
        },
      }) as any,
      createRouteContext({ chapterId: activeMembership.chapterId }) as any
    );

    expect(response.status).toBe(200);
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith({
      where: { id: activeMembership.id },
      data: {
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        notificationPreferencesJson: null,
      },
    });
  });

  it('ignores obsolete SMS preference fields', async () => {
    const { PATCH } = loadChapterNotificationsRoute();
    const hacker = buildHacker();
    const activeMembership = buildChapterMembership({
      id: 'membership-sms-opt-out',
      chapterId: 'chapter-boston',
      hackerId: hacker.id,
      notificationsAllowed: true,
      smsNotificationsEnabled: true,
      smsConsentAt: new Date('2026-07-10T16:00:00.000Z'),
      smsConsentVersion: '2026-07-10',
    });

    mockActor(hacker);
    mockMembershipLookup(activeMembership);
    prisma.chapterMembership.update.mockResolvedValue({
      ...activeMembership,
      smsNotificationsEnabled: false,
      smsConsentAt: null,
      smsConsentVersion: null,
    });

    const response = await PATCH(
      createJsonRequest('/api/chapters/chapter-boston/notifications', {
        method: 'PATCH',
        body: {
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          smsConsentGranted: false,
        },
      }) as any,
      createRouteContext({ chapterId: activeMembership.chapterId }) as any
    );

    expect(response.status).toBe(200);
    expect(prisma.chapterMembership.update).toHaveBeenCalledWith({
      where: { id: activeMembership.id },
      data: {
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        notificationPreferencesJson: null,
      },
    });
  });
});
