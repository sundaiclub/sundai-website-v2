import { NextRequest } from 'next/server';
import { POST as POST_ADVANCE } from '../../src/app/api/events/[eventId]/advance/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventProject: { findMany: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/events/[eventId]/advance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when phase is VOTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'VOTING',
      mcs: [],
      projects: [],
    });

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PITCHING');
  });

  it('works when phase is PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        mcs: [],
        projects: [
          { id: 'ep1', position: 1, status: 'QUEUED' },
        ],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [
          { id: 'ep1', position: 1, status: 'CURRENT' },
        ],
      });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'QUEUED' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });
});
