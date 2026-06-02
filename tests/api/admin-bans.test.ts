import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerkUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapterAdminFixture,
  buildHacker,
  buildSiteAdmin,
  buildUserBan,
} from '../utils/event-management-fixtures';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    userBan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

const mockPrisma = require('../../src/lib/prisma').default;
const {
  GET: GET_BANS,
  POST: POST_BAN,
} = require('../../src/app/api/admin/bans/route');
const {
  PATCH: PATCH_BAN,
} = require('../../src/app/api/admin/bans/[banId]/route');

function signInAs(hacker: { clerkId: string; email: string | null }) {
  mockAuthenticatedClerkUser(
    { userId: hacker.clerkId },
    {
      id: hacker.clerkId,
      primaryEmailAddress: {
        id: `${hacker.clerkId}-email`,
        emailAddress: hacker.email ?? `${hacker.clerkId}@example.com`,
      },
    }
  );
}

describe('/api/admin/bans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('creates a global ban for a selected hacker as a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const bannedHacker = buildHacker({
      id: 'hacker-banned',
      clerkId: 'clerk-banned',
      name: 'Banned User',
      email: 'banned@example.com',
    });
    const createdBan = buildUserBan({
      id: 'ban-created',
      hackerId: bannedHacker.id,
      createdById: siteAdmin.id,
      publicSafeReason:
        'You are unable to register for this event at this time.',
      internalNote: 'Repeated safety issue across chapters.',
    });

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) => {
        if (where.clerkId === siteAdmin.clerkId) return siteAdmin;
        if (where.id === bannedHacker.id) return bannedHacker;
        return null;
      }
    );
    mockPrisma.userBan.create.mockResolvedValue(createdBan);

    const response = await POST_BAN(
      createJsonRequest('/api/admin/bans', {
        method: 'POST',
        body: {
          hackerId: bannedHacker.id,
          publicSafeReason:
            'You are unable to register for this event at this time.',
          internalNote: 'Repeated safety issue across chapters.',
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.userBan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hackerId: bannedHacker.id,
          createdById: siteAdmin.id,
          publicSafeReason:
            'You are unable to register for this event at this time.',
          internalNote: 'Repeated safety issue across chapters.',
        }),
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: createdBan.id,
        hackerId: bannedHacker.id,
        revokedAt: null,
      })
    );
  });

  it('rejects a ban when no selected hacker is provided', async () => {
    const siteAdmin = buildSiteAdmin();

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);

    const response = await POST_BAN(
      createJsonRequest('/api/admin/bans', {
        method: 'POST',
        body: {},
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'hackerId is required' });
    expect(mockPrisma.userBan.create).not.toHaveBeenCalled();
  });

  it('rejects a ban when the selected hacker is not found', async () => {
    const siteAdmin = buildSiteAdmin();

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) => {
        if (where.clerkId === siteAdmin.clerkId) return siteAdmin;
        return null;
      }
    );

    const response = await POST_BAN(
      createJsonRequest('/api/admin/bans', {
        method: 'POST',
        body: { hackerId: 'hacker-missing' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'Selected hacker was not found' });
    expect(mockPrisma.userBan.create).not.toHaveBeenCalled();
  });

  it('lists global bans only for site admins', async () => {
    const siteAdmin = buildSiteAdmin();
    const activeBan = buildUserBan({
      id: 'ban-active',
      hackerId: 'hacker-banned',
      createdById: siteAdmin.id,
    });
    const revokedBan = buildUserBan({
      id: 'ban-revoked',
      hackerId: 'hacker-revoked',
      createdById: siteAdmin.id,
      revokedById: siteAdmin.id,
      revokedAt: new Date('2026-05-25T13:00:00.000Z'),
      revocationReason: 'Appeal approved.',
    });

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.userBan.findMany.mockResolvedValue([activeBan, revokedBan]);

    const response = await GET_BANS(createJsonRequest('/api/admin/bans'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.userBan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.anything(),
      })
    );
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: activeBan.id, revokedAt: null }),
        expect.objectContaining({
          id: revokedBan.id,
          revokedById: siteAdmin.id,
        }),
      ])
    );
  });

  it('does not expose global bans to non-site-admin callers', async () => {
    const { hacker } = buildChapterAdminFixture();

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);

    const response = await GET_BANS(createJsonRequest('/api/admin/bans'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(mockPrisma.userBan.findMany).not.toHaveBeenCalled();
    expect(body).toBe('Forbidden');
  });
});

describe('/api/admin/bans/[banId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('revokes a global ban as a site admin without deleting audit history', async () => {
    const siteAdmin = buildSiteAdmin();
    const existingBan = buildUserBan({
      id: 'ban-active',
      hackerId: 'hacker-banned',
      createdById: siteAdmin.id,
    });
    const revokedBan = {
      ...existingBan,
      revokedById: siteAdmin.id,
      revokedAt: new Date('2026-05-25T13:00:00.000Z'),
      revocationReason: 'Appeal approved.',
    };

    signInAs(siteAdmin);
    mockPrisma.hacker.findUnique.mockResolvedValue(siteAdmin);
    mockPrisma.userBan.findUnique.mockResolvedValue(existingBan);
    mockPrisma.userBan.update.mockResolvedValue(revokedBan);

    const response = await PATCH_BAN(
      createJsonRequest('/api/admin/bans/ban-active', {
        method: 'PATCH',
        body: {
          revocationReason: 'Appeal approved.',
        },
      }),
      createRouteContext({ banId: existingBan.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.userBan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingBan.id },
        data: expect.objectContaining({
          revokedById: siteAdmin.id,
          revokedAt: expect.any(Date),
          revocationReason: 'Appeal approved.',
        }),
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: existingBan.id,
        createdById: siteAdmin.id,
        revokedById: siteAdmin.id,
        revocationReason: 'Appeal approved.',
      })
    );
  });

  it('does not expose revocation to non-site-admin callers', async () => {
    const { hacker } = buildChapterAdminFixture();

    signInAs(hacker);
    mockPrisma.hacker.findUnique.mockResolvedValue(hacker);

    const response = await PATCH_BAN(
      createJsonRequest('/api/admin/bans/ban-active', {
        method: 'PATCH',
        body: {
          revocationReason: 'Not authorized.',
        },
      }),
      createRouteContext({ banId: 'ban-active' })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(mockPrisma.userBan.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.userBan.update).not.toHaveBeenCalled();
    expect(body).toBe('Forbidden');
  });
});
