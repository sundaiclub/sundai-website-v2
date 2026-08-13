import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/events/[eventId]/pitch/timer/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    event: { findUnique: jest.fn() },
    pitchSession: { findFirst: jest.fn() },
    pitchProject: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;
const params = { params: { eventId: 'e1' } } as any;

function makeRequest(action: string) {
  return new NextRequest('http://localhost:3000/api/events/e1/pitch/timer', {
    method: 'POST',
    body: JSON.stringify({ action, pitchProjectId: 'ep1' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function authorizeAdmin() {
  mockAuth.mockReturnValue({ userId: 'clerk-admin' });
  prisma.hacker.findUnique.mockResolvedValue({
    id: 'h-admin',
    role: 'SITE_ADMIN',
  });
  prisma.event.findUnique.mockResolvedValue({ id: 'e1', staff: [] });
}

describe('/api/events/[eventId]/pitch/timer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'PITCHING',
      topPitchSec: 300,
      defaultPitchSec: 180,
    });
    prisma.pitchProject.update.mockResolvedValue({});
  });

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await POST(makeRequest('start') as any, params);

    expect(response.status).toBe(401);
  });

  it('rejects users without pitch access', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', staff: [] });

    const response = await POST(makeRequest('start') as any, params);

    expect(response.status).toBe(403);
  });

  it('starts one timer with the stored total time', async () => {
    authorizeAdmin();
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      status: 'CURRENT',
      timerPhase: 'WAITING',
      allottedSec: 240,
      isTopProject: false,
    });

    const response = await POST(makeRequest('start') as any, params);

    expect(response.status).toBe(200);
    expect(prisma.pitchProject.update).toHaveBeenCalledWith({
      where: { id: 'ep1' },
      data: {
        timerPhase: 'RUNNING',
        timerStartedAt: expect.any(Date),
        allottedSec: 240,
      },
    });
  });

  it('uses the top-project total time when an allotment is missing', async () => {
    authorizeAdmin();
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      status: 'CURRENT',
      timerPhase: 'WAITING',
      allottedSec: null,
      isTopProject: true,
    });

    await POST(makeRequest('start') as any, params);

    expect(prisma.pitchProject.update.mock.calls[0][0].data.allottedSec).toBe(
      300
    );
  });

  it('stops a running timer', async () => {
    authorizeAdmin();
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      status: 'CURRENT',
      timerPhase: 'RUNNING',
    });

    const response = await POST(makeRequest('stop') as any, params);

    expect(response.status).toBe(200);
    expect(prisma.pitchProject.update).toHaveBeenCalledWith({
      where: { id: 'ep1' },
      data: { timerPhase: 'COMPLETED', completedAt: expect.any(Date) },
    });
  });

  it('rejects stop before the timer starts', async () => {
    authorizeAdmin();
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      status: 'CURRENT',
      timerPhase: 'WAITING',
    });

    const response = await POST(makeRequest('stop') as any, params);

    expect(response.status).toBe(400);
    expect(prisma.pitchProject.update).not.toHaveBeenCalled();
  });

});
