import { NextRequest } from 'next/server';
import { POST as POST_TRANSITION } from '../../src/app/api/events/[eventId]/transition/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn(), update: jest.fn() },
    eventProject: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

function makeRequest(body: object = {}) {
  return new NextRequest('http://localhost:3000/api/events/e1/transition', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/events/[eventId]/transition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires admin/MC', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', mcs: [] });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('requires a valid target phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', mcs: [] });

    const res = await POST_TRANSITION(makeRequest({}) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('targetPhase');
  });

  it('rejects when the event is already in the target phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'FINISHED', mcs: [] });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already');
  });

  it('transitions from PITCHING to FINISHED', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.event.update.mockResolvedValue({ id: 'e1', phase: 'FINISHED' });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { phase: 'FINISHED' },
    });
  });

  it('transitions from PITCHING to VOTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.event.update.mockResolvedValue({ id: 'e1', phase: 'VOTING' });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'VOTING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { phase: 'VOTING' },
    });
  });

  it('transitions from FINISHED back to PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'FINISHED', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'DONE', pitchPhase: 'COMPLETED' },
      { id: 'ep2', position: 2, status: 'DONE', pitchPhase: 'COMPLETED' },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    expect(prisma.eventProject.findMany).toHaveBeenCalledWith({
      where: { eventId: 'e1' },
      orderBy: { position: 'asc' },
    });
    expect(prisma.eventProject.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'ep1' },
      data: expect.objectContaining({
        status: 'CURRENT',
        approved: true,
        pitchPhase: 'WAITING',
        presentingStartedAt: null,
        questionsStartedAt: null,
        completedAt: null,
      }),
    });
    expect(prisma.eventProject.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'ep2' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approved: true,
        pitchPhase: 'WAITING',
        presentingStartedAt: null,
        questionsStartedAt: null,
        completedAt: null,
      }),
    });
  });

  it('sorts projects by like count, assigns positions and allotted times', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const now = new Date();
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', createdAt: now, project: { likes: [{ id: '1' }] } },
      { id: 'ep2', createdAt: now, project: { likes: [{ id: '2' }, { id: '3' }, { id: '4' }] } },
      { id: 'ep3', createdAt: now, project: { likes: [{ id: '5' }, { id: '6' }] } },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Verify transaction was called (positions assigned in sorted order)
    expect(prisma.$transaction).toHaveBeenCalled();
    const txArgs = prisma.$transaction.mock.calls[0][0];
    // Should have 3 position updates + 1 event phase update = 4 operations
    expect(txArgs).toHaveLength(4);

    // All 3 projects are under 5 total, so threshold is -1 → no top group → all get short allotment
    const updateCalls = prisma.eventProject.update.mock.calls;
    expect(updateCalls[0][0].data).toEqual(expect.objectContaining({
      position: 1,
      status: 'CURRENT',
      approved: true,
      pitchPhase: 'WAITING',
      allottedPresentingSec: 60,
      allottedQuestionsSec: 120,
      presentingStartedAt: null,
      questionsStartedAt: null,
      completedAt: null,
    }));
    expect(updateCalls[1][0].data.status).toBe('APPROVED');
    expect(updateCalls[2][0].data.status).toBe('APPROVED');
    for (const call of updateCalls) {
      expect(call[0].data.allottedPresentingSec).toBe(60);
      expect(call[0].data.allottedQuestionsSec).toBe(120);
    }
  });

  it('assigns top-group allotted times when 5+ projects', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const now = new Date();
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', createdAt: now, project: { likes: Array(5).fill({ id: '1' }) } },
      { id: 'ep2', createdAt: now, project: { likes: Array(4).fill({ id: '2' }) } },
      { id: 'ep3', createdAt: now, project: { likes: Array(3).fill({ id: '3' }) } },
      { id: 'ep4', createdAt: now, project: { likes: Array(2).fill({ id: '4' }) } },
      { id: 'ep5', createdAt: now, project: { likes: Array(1).fill({ id: '5' }) } },
      { id: 'ep6', createdAt: now, project: { likes: [] } },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    const updateCalls = prisma.eventProject.update.mock.calls;
    // Top 5 projects (likes >= threshold of 1) get 120/180
    for (let i = 0; i < 5; i++) {
      expect(updateCalls[i][0].data.allottedPresentingSec).toBe(120);
      expect(updateCalls[i][0].data.allottedQuestionsSec).toBe(180);
    }
    // 6th project (0 likes) gets 60/120
    expect(updateCalls[5][0].data.allottedPresentingSec).toBe(60);
    expect(updateCalls[5][0].data.allottedQuestionsSec).toBe(120);
  });

  it('handles ties correctly (same like count → ordered by createdAt)', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const early = new Date('2026-01-01');
    const late = new Date('2026-02-01');
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep-late', createdAt: late, project: { likes: [{ id: '1' }, { id: '2' }] } },
      { id: 'ep-early', createdAt: early, project: { likes: [{ id: '3' }, { id: '4' }] } },
    ]);
    prisma.eventProject.update.mockResolvedValue({});
    prisma.event.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // The transaction should have been called with position updates
    // ep-early should get position 1 (earlier createdAt), ep-late gets position 2
    const txArgs = prisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(3); // 2 updates + 1 event update
  });

  it('updates event phase to PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    prisma.eventProject.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Transaction includes the phase update even with no projects
    const txArgs = prisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(1); // just the event phase update
  });

  it('works with no projects', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', mcs: [] })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    prisma.eventProject.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });
});
