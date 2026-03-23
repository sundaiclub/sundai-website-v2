import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/events/[eventId]/current/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventProject: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

function makeRequest(body: object = {}) {
  return new NextRequest('http://localhost:3000/api/events/e1/current', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/events/[eventId]/current', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects non-admin/MC users', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });

    const res = await POST(makeRequest({ eventProjectId: 'ep2' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('rejects when event is not pitching', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'FINISHED', mcs: [] });

    const res = await POST(makeRequest({ eventProjectId: 'ep2' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PITCHING');
  });

  it('switches the current project and resets timers', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', pitchPhase: 'PRESENTING' },
      { id: 'ep2', position: 2, status: 'DONE', pitchPhase: 'COMPLETED' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST(makeRequest({ eventProjectId: 'ep2' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    expect(prisma.eventProject.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'ep1' },
      data: {
        status: 'APPROVED',
        approved: true,
        pitchPhase: 'WAITING',
        presentingStartedAt: null,
        questionsStartedAt: null,
        completedAt: null,
      },
    });
    expect(prisma.eventProject.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'ep2' },
      data: {
        status: 'CURRENT',
        approved: true,
        pitchPhase: 'WAITING',
        presentingStartedAt: null,
        questionsStartedAt: null,
        completedAt: null,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
