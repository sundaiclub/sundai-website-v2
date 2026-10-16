import { GET } from '@/app/api/events/project-options/route';
import { mockAuthenticatedClerk, resetClerkMocks } from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    event: { findMany: jest.fn() },
    judgingTrack: { findMany: jest.fn() },
    judgingSubmission: { findMany: jest.fn() },
  },
}));

const prisma = require('@/lib/prisma').default;

describe('GET /api/events/project-options', () => {
  const now = new Date('2026-08-28T17:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockAuthenticatedClerk({ userId: 'clerk-user' });
    prisma.judgingTrack.findMany.mockResolvedValue([]);
    prisma.judgingSubmission.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.useRealTimers());

  it('shows current RSVP events selected by default for a hacker', async () => {
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Boston Build Night',
        startTime: new Date('2026-08-28T16:00:00.000Z'),
        endTime: new Date('2026-08-28T21:00:00.000Z'),
        image: { url: 'https://example.com/event.png', alt: 'Builders' },
        chapter: { id: 'chapter-1', name: 'Sundai Boston', slug: 'boston' },
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/events/project-options')
    );

    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: [
            {
              OR: expect.arrayContaining([
                {
                  judgingEnabled: false,
                  startTime: { lte: now },
                  endTime: { gte: now },
                },
              ]),
            },
          ],
          OR: expect.arrayContaining([
            {
              registrations: {
                some: {
                  hackerId: 'hacker-1',
                  status: 'APPROVED',
                  cancelledAt: null,
                },
              },
            },
            {
              chapter: {
                memberships: {
                  some: {
                    hackerId: 'hacker-1',
                    role: 'ADMIN',
                    status: 'ACTIVE',
                  },
                },
              },
            },
          ]),
        }),
      })
    );
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'event-1',
        chapterName: 'Sundai Boston',
        selectedByDefault: true,
        judging: null,
      }),
    ]);
  });

  it('offers judging events in their submission window with tracks and saved answers', async () => {
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.project.findUnique.mockResolvedValue({
      launchLeadId: 'hacker-1',
      participants: [],
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-judged',
        title: 'Demo Day',
        startTime: now,
        endTime: null,
        image: null,
        chapter: { id: 'chapter-1', name: 'Sundai Boston', slug: 'boston' },
        projects: [{ id: 'event-project-1' }],
      },
    ]);
    prisma.judgingTrack.findMany.mockResolvedValue([
      {
        id: 'track-ai',
        eventId: 'event-judged',
        name: 'AI',
        description: null,
        questionsJson: [
          { id: 'q1', prompt: 'What did you build?', required: true },
        ],
      },
    ]);
    prisma.judgingSubmission.findMany.mockResolvedValue([
      {
        eventId: 'event-judged',
        trackId: 'track-ai',
        answersJson: { q1: 'A robot', additionalInfo: '' },
      },
    ]);

    const response = await GET(
      new Request(
        'http://localhost/api/events/project-options?projectId=project-1'
      )
    );

    const query = prisma.event.findMany.mock.calls[0][0];
    expect(query.where.AND[0].OR).toContainEqual(
      expect.objectContaining({ judgingEnabled: true })
    );
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'event-judged',
        judging: {
          tracks: [
            {
              id: 'track-ai',
              name: 'AI',
              description: null,
              questions: [
                { id: 'q1', prompt: 'What did you build?', required: true },
              ],
            },
          ],
          submission: {
            trackId: 'track-ai',
            answers: { q1: 'A robot', additionalInfo: '' },
          },
        },
      }),
    ]);
  });

  it('shows every current event deselected for a site admin', async () => {
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: 'SITE_ADMIN',
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Boston Build Night',
        startTime: now,
        endTime: new Date('2026-08-28T21:00:00.000Z'),
        image: null,
        chapter: { id: 'chapter-1', name: 'Sundai Boston', slug: 'boston' },
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/events/project-options')
    );
    const query = prisma.event.findMany.mock.calls[0][0];

    expect(query.where.OR).toBeUndefined();
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 'event-1', selectedByDefault: false }),
    ]);
  });

  it('includes active events managed by a chapter admin', async () => {
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'chapter-admin-1',
      role: 'HACKER',
    });
    prisma.event.findMany.mockResolvedValue([]);

    await GET(new Request('http://localhost/api/events/project-options'));

    const query = prisma.event.findMany.mock.calls[0][0];
    expect(query.where.OR).toContainEqual({
      chapter: {
        memberships: {
          some: {
            hackerId: 'chapter-admin-1',
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    });
  });

  it('marks current events that already contain an editable project', async () => {
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.project.findUnique.mockResolvedValue({
      launchLeadId: 'hacker-1',
      participants: [],
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-added',
        title: 'Boston Build Night',
        startTime: now,
        endTime: new Date('2026-08-28T21:00:00.000Z'),
        image: null,
        chapter: { id: 'chapter-1', name: 'Sundai Boston', slug: 'boston' },
        projects: [{ id: 'event-project-1' }],
      },
      {
        id: 'event-new',
        title: 'Cambridge Build Night',
        startTime: now,
        endTime: new Date('2026-08-28T21:00:00.000Z'),
        image: null,
        chapter: {
          id: 'chapter-2',
          name: 'Sundai Cambridge',
          slug: 'cambridge',
        },
        projects: [],
      },
    ]);

    const response = await GET(
      new Request(
        'http://localhost/api/events/project-options?projectId=project-1'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'event-added',
        alreadyAdded: true,
        selectedByDefault: true,
      }),
      expect.objectContaining({
        id: 'event-new',
        alreadyAdded: false,
        selectedByDefault: false,
      }),
    ]);
  });
});
