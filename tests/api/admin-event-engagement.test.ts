import {
  mockAuthenticatedClerkUser,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildHacker,
  buildSiteAdmin,
} from '../utils/event-management-fixtures';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

const mockPrisma = require('../../src/lib/prisma').default;
const { GET } = require('../../src/app/api/admin/event-engagement/route');

function signInAs(hacker: { clerkId: string }) {
  mockAuthenticatedClerkUser({ userId: hacker.clerkId });
  mockPrisma.hacker.findUnique.mockResolvedValue(hacker);
}

describe('/api/admin/event-engagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('rejects anonymous users', async () => {
    mockSignedOutClerk();

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects signed-in users who are not site admins', async () => {
    signInAs(buildHacker());

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns the chapter report to site admins without caching', async () => {
    signInAs(buildSiteAdmin());
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        eventId: 'event-1',
        title: 'Sundai Hack',
        startTime: new Date('2026-11-01T15:00:00Z'),
        chapterId: 'chapter-1',
        chapterName: 'Sundai Boston',
        rsvps: 80,
        projects: 12,
        presented: 10,
        rsvpBuilders: 20,
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.chapters).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-1',
        chapterName: 'Sundai Boston',
        builtRate: 0.25,
        events: [
          expect.objectContaining({
            eventId: 'event-1',
            rank: 1,
            builtRate: 0.25,
            startTime: '2026-11-01T15:00:00.000Z',
          }),
        ],
      }),
    ]);
  });
});
