import { NextRequest } from 'next/server';
import { GET } from '@/app/api/events/[eventId]/pitch/project-options/route';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    project: { findMany: jest.fn() },
  },
}));

const prisma = require('@/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('GET /api/events/[eventId]/pitch/project-options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60_000),
      registrations: [{ id: 'registration-1' }],
      staff: [],
      pitchSessions: [{ id: 'pitch-1', phase: 'VOTING' }],
    });
  });

  it('returns only owned published projects with event and pitch flags', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Queue project',
        preview: 'Ready to pitch',
        startDate: new Date(),
        eventParticipations: [{ id: 'event-project-1' }],
        pitchEntries: [{ id: 'pitch-project-1' }],
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/events/event-1/pitch/project-options'
      ),
      { params: { eventId: 'event-1' } }
    );

    expect(response.status).toBe(200);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'APPROVED',
          OR: [
            { launchLeadId: 'hacker-1' },
            { participants: { some: { hackerId: 'hacker-1' } } },
          ],
        },
      })
    );
    await expect(response.json()).resolves.toEqual({
      projects: [
        expect.objectContaining({
          id: 'project-1',
          eventAdded: true,
          pitchAdded: true,
        }),
      ],
    });
  });
});
