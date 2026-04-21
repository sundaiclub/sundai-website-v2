import { NextRequest } from 'next/server';
import { POST as POST_ADVANCE } from '../../src/app/api/events/[eventId]/advance/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn(), update: jest.fn() },
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
      { id: 'ep1', position: 1, status: 'QUEUED', pitchPhase: 'WAITING' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });

  it('finishes the event when there is no next project', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        mcs: [],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'FINISHED',
        projects: [
          { id: 'ep1', position: 1, status: 'DONE' },
        ],
      });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', pitchPhase: 'COMPLETED' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { phase: 'FINISHED' },
    });
  });

  it('auto-completes timer when advancing from PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        mcs: [],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [],
      });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', pitchPhase: 'PRESENTING', presentingStartedAt: new Date() },
      { id: 'ep2', position: 2, status: 'QUEUED', pitchPhase: 'WAITING' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Current project should be marked DONE with COMPLETED pitchPhase
    const doneCall = prisma.eventProject.update.mock.calls[0];
    expect(doneCall[0].data.status).toBe('DONE');
    expect(doneCall[0].data.pitchPhase).toBe('COMPLETED');
    expect(doneCall[0].data.completedAt).toBeDefined();
    expect(doneCall[0].data.questionsStartedAt).toBeDefined();

    // Next project should be set to CURRENT with WAITING pitchPhase
    const nextCall = prisma.eventProject.update.mock.calls[1];
    expect(nextCall[0].data.status).toBe('CURRENT');
    expect(nextCall[0].data.pitchPhase).toBe('WAITING');
  });

  it('auto-completes timer when advancing from QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        mcs: [],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [],
      });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', pitchPhase: 'QUESTIONS', questionsStartedAt: new Date() },
      { id: 'ep2', position: 2, status: 'QUEUED', pitchPhase: 'WAITING' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    const doneCall = prisma.eventProject.update.mock.calls[0];
    expect(doneCall[0].data.status).toBe('DONE');
    expect(doneCall[0].data.pitchPhase).toBe('COMPLETED');
    expect(doneCall[0].data.completedAt).toBeDefined();
    // Should NOT set questionsStartedAt since already in QUESTIONS phase
    expect(doneCall[0].data.questionsStartedAt).toBeUndefined();
  });
});
