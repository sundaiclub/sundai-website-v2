import { GET } from '../../src/app/api/events/mine/route';
import {
  mockAuthenticatedClerk,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findMany: jest.fn() },
  },
}));

const prisma = require('../../src/lib/prisma').default;
const now = new Date('2026-08-28T17:00:00.000Z');

describe('GET /api/events/mine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => jest.useRealTimers());

  it('returns future and live published events that the user is approved for', async () => {
    mockAuthenticatedClerk({ userId: 'clerk-user' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-user',
      role: 'HACKER',
      name: 'Builder',
      email: 'builder@example.com',
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-future',
        slug: 'future-build',
        title: 'Future Build',
        timezone: 'America/New_York',
        publicLocation: 'Cambridge, MA',
        startTime: new Date('2026-09-18T16:00:00.000Z'),
        endTime: new Date('2026-09-18T20:00:00.000Z'),
        image: {
          id: 'image-future',
          url: 'https://example.com/future-build.png',
          alt: 'Builders at a Sundai event',
        },
        chapter: {
          id: 'chapter-boston',
          slug: 'boston',
          name: 'Sundai Boston',
          timezone: 'America/New_York',
        },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          OR: [{ startTime: { gte: now } }, { endTime: { gte: now } }],
          registrations: {
            some: {
              hackerId: 'hacker-user',
              status: 'APPROVED',
              cancelledAt: null,
            },
          },
        },
      })
    );
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: 'event-future',
        chapterSlug: 'boston',
        chapterName: 'Sundai Boston',
        image: expect.objectContaining({ id: 'image-future' }),
      })
    );
  });

  it('requires a signed-in user', async () => {
    mockSignedOutClerk();
    prisma.hacker.findUnique.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });
});
