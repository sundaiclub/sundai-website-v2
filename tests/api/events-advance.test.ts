import { NextRequest } from 'next/server';
import { POST as POST_ADVANCE } from '../../src/app/api/events/[eventId]/pitch/advance/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    event: { findUnique: jest.fn(), update: jest.fn() },
    pitchSession: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    pitchProject: { findMany: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/events/[eventId]/advance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'PITCHING' });
    prisma.pitchSession.findUnique.mockResolvedValue({ id: 'ps1', phase: 'PITCHING', projects: [] });
    prisma.pitchSession.update.mockResolvedValue({});
  });

  it('rejects when phase is VOTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      staff: [],
      projects: [],
    });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'VOTING' });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PITCHING');
  });

  it('works when phase is PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        staff: [],
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

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'QUEUED', timerPhase: 'WAITING' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });

  it('allows assigned EventStaff MCs to advance pitches', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        staff: [{ hackerId: 'h-mc', role: 'MC' }],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [{ id: 'ep1', position: 1, status: 'CURRENT' }],
      });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'QUEUED', timerPhase: 'WAITING' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });

  it('allows assigned EventStaff co-MCs to advance pitches', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-co-mc', role: 'HACKER' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [{ id: 'ep1', position: 1, status: 'CURRENT' }],
      });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'QUEUED', timerPhase: 'WAITING' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });

  it('finishes the event when there is no next project', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        staff: [],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'FINISHED',
        projects: [
          { id: 'ep1', position: 1, status: 'DONE' },
        ],
      });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', timerPhase: 'COMPLETED' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
    expect(prisma.pitchSession.update).toHaveBeenCalledWith({
      where: { id: 'ps1' },
      data: { phase: 'FINISHED' },
    });
  });

  it('auto-completes a running timer when advancing', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        staff: [],
        projects: [],
      })
      .mockResolvedValueOnce({
        id: 'e1',
        phase: 'PITCHING',
        projects: [],
      });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'CURRENT', timerPhase: 'RUNNING', timerStartedAt: new Date() },
      { id: 'ep2', position: 2, status: 'QUEUED', timerPhase: 'WAITING' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/advance', { method: 'POST' });
    const res = await POST_ADVANCE(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Current project should be marked DONE with a completed timer.
    const doneCall = prisma.pitchProject.update.mock.calls[0];
    expect(doneCall[0].data.status).toBe('DONE');
    expect(doneCall[0].data.timerPhase).toBe('COMPLETED');
    expect(doneCall[0].data.completedAt).toBeDefined();
    // Next project should be set to CURRENT with a waiting timer.
    const nextCall = prisma.pitchProject.update.mock.calls[1];
    expect(nextCall[0].data.status).toBe('CURRENT');
    expect(nextCall[0].data.timerPhase).toBe('WAITING');
  });
});
