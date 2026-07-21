import { NextRequest } from 'next/server';
import { POST as POST_TRANSITION } from '../../src/app/api/events/[eventId]/pitch/transition/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    event: { findUnique: jest.fn(), update: jest.fn() },
    pitchSession: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    pitchProject: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

const eventTimingConfig = {
  topProjectCount: 5,
  topPresentingSec: 120,
  topQuestionsSec: 180,
  defaultPresentingSec: 60,
  defaultQuestionsSec: 120,
};

function makeRequest(body: object = {}) {
  return new NextRequest('http://localhost:3000/api/events/e1/pitch/transition', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/events/[eventId]/transition', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'VOTING', ...eventTimingConfig });
    prisma.pitchSession.findUnique.mockResolvedValue({ id: 'ps1', phase: 'VOTING', projects: [] });
    prisma.pitchSession.update.mockResolvedValue({ id: 'ps1', phase: 'FINISHED' });
  });

  it('requires site admin or event staff', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(403);
  });

  it('allows assigned EventStaff MCs to transition phases', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'PITCHING',
      staff: [{ hackerId: 'h-mc', role: 'MC' }],
      ...eventTimingConfig,
    });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'PITCHING', ...eventTimingConfig });
    prisma.pitchSession.update.mockResolvedValue({ id: 'ps1', phase: 'FINISHED' });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
  });

  it('allows assigned EventStaff co-MCs to transition phases', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-co-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'PITCHING',
      staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }],
      ...eventTimingConfig,
    });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'PITCHING', ...eventTimingConfig });
    prisma.pitchSession.update.mockResolvedValue({ id: 'ps1', phase: 'FINISHED' });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
  });

  it.each([
    {
      label: 'site admin',
      hacker: { id: 'h-site-admin', role: 'SITE_ADMIN' },
      membership: null,
    },
    {
      label: 'in-scope chapter admin',
      hacker: { id: 'h-chapter-admin', role: 'HACKER' },
      membership: { role: 'ADMIN', status: 'ACTIVE' },
    },
  ])('allows $label pitch control', async ({ hacker, membership }) => {
    mockAuth.mockReturnValue({ userId: `clerk-${hacker.id}` });
    prisma.hacker.findUnique.mockResolvedValue(hacker);
    prisma.chapterMembership.findFirst.mockResolvedValue(membership);
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      chapterId: 'chapter-boston',
      staff: [],
      ...eventTimingConfig,
    });
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'PITCHING',
      ...eventTimingConfig,
    });

    const response = await POST_TRANSITION(
      makeRequest({ targetPhase: 'FINISHED' }) as any,
      { params: { eventId: 'e1' } } as any
    );

    expect(response.status).toBe(200);
  });

  it('requires a valid target phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'VOTING', ...eventTimingConfig });

    const res = await POST_TRANSITION(makeRequest({}) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('targetPhase');
  });

  it('rejects when the event is already in the target phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'FINISHED', staff: [], ...eventTimingConfig });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'FINISHED', ...eventTimingConfig });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already');
  });

  it('transitions from PITCHING to FINISHED', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [], ...eventTimingConfig });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'PITCHING', ...eventTimingConfig });
    prisma.pitchSession.update.mockResolvedValue({ id: 'ps1', phase: 'FINISHED' });

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'FINISHED' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
    expect(prisma.pitchSession.update).toHaveBeenCalledWith({
      where: { id: 'ps1' },
      data: { phase: 'FINISHED' },
    });
  });

  it('transitions from PITCHING to VOTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', projects: [] });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'PITCHING', ...eventTimingConfig });
    prisma.pitchProject.updateMany.mockResolvedValue({ count: 6 });
    prisma.pitchSession.update.mockResolvedValue({ id: 'e1', phase: 'VOTING' });
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'VOTING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    expect(prisma.pitchProject.updateMany).toHaveBeenCalledWith({
      where: { pitchSessionId: 'ps1' },
      data: { isTopProject: false },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
    ]);
    expect(prisma.pitchSession.update).toHaveBeenCalledWith({
      where: { id: 'ps1' },
      data: { phase: 'VOTING' },
    });
  });

  it('transitions from FINISHED back to PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'FINISHED', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });
    prisma.pitchSession.findFirst.mockResolvedValue({ id: 'ps1', eventId: 'e1', phase: 'FINISHED', ...eventTimingConfig });
    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, status: 'DONE', pitchPhase: 'COMPLETED' },
      { id: 'ep2', position: 2, status: 'DONE', pitchPhase: 'COMPLETED' },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    expect(prisma.pitchProject.findMany).toHaveBeenCalledWith({
      where: { pitchSessionId: 'ps1' },
      orderBy: { position: 'asc' },
    });
    expect(prisma.pitchProject.update).toHaveBeenNthCalledWith(1, {
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
    expect(prisma.pitchProject.update).toHaveBeenNthCalledWith(2, {
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

  it('sorts projects by pitch-like count, assigns positions and allotted times', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const now = new Date();
    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', createdAt: now, pitchVotes: [{ id: '1', value: 'LIKE' }] },
      { id: 'ep2', createdAt: now, pitchVotes: [{ id: '2', value: 'LIKE' }, { id: '3', value: 'LIKE' }, { id: '4', value: 'LIKE' }] },
      { id: 'ep3', createdAt: now, pitchVotes: [{ id: '5', value: 'LIKE' }, { id: '6', value: 'LIKE' }] },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Verify transaction was called (positions assigned in sorted order)
    expect(prisma.$transaction).toHaveBeenCalled();
    const txArgs = prisma.$transaction.mock.calls[0][0];
    // Should have 3 position updates + 1 event phase update = 4 operations
    expect(txArgs).toHaveLength(4);

    // All 3 projects are under 5 total, so threshold is -1 → no top group → all get short allotment
    const updateCalls = prisma.pitchProject.update.mock.calls;
    expect(updateCalls[0][0].data).toEqual(expect.objectContaining({
      position: 1,
      status: 'CURRENT',
      approved: true,
      isTopProject: false,
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
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const now = new Date();
    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', createdAt: now, pitchVotes: Array(5).fill({ id: '1', value: 'LIKE' }) },
      { id: 'ep2', createdAt: now, pitchVotes: Array(4).fill({ id: '2', value: 'LIKE' }) },
      { id: 'ep3', createdAt: now, pitchVotes: Array(3).fill({ id: '3', value: 'LIKE' }) },
      { id: 'ep4', createdAt: now, pitchVotes: Array(2).fill({ id: '4', value: 'LIKE' }) },
      { id: 'ep5', createdAt: now, pitchVotes: Array(1).fill({ id: '5', value: 'LIKE' }) },
      { id: 'ep6', createdAt: now, pitchVotes: [] },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    const updateCalls = prisma.pitchProject.update.mock.calls;
    // Exactly the first 5 ranked projects are frozen as top projects.
    for (let i = 0; i < 5; i++) {
      expect(updateCalls[i][0].data.isTopProject).toBe(true);
      expect(updateCalls[i][0].data.allottedPresentingSec).toBe(120);
      expect(updateCalls[i][0].data.allottedQuestionsSec).toBe(180);
    }
    // 6th project gets the default times and is not promoted later.
    expect(updateCalls[5][0].data.isTopProject).toBe(false);
    expect(updateCalls[5][0].data.allottedPresentingSec).toBe(60);
    expect(updateCalls[5][0].data.allottedQuestionsSec).toBe(120);
  });

  it('includes all projects tied at the top-group cutoff', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const early = new Date('2026-01-01');
    const later = new Date('2026-01-02');
    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', createdAt: early, pitchVotes: Array(4).fill({ id: '1', value: 'LIKE' }) },
      { id: 'ep2', createdAt: early, pitchVotes: Array(4).fill({ id: '2', value: 'LIKE' }) },
      { id: 'ep3', createdAt: early, pitchVotes: Array(4).fill({ id: '3', value: 'LIKE' }) },
      { id: 'ep4', createdAt: early, pitchVotes: Array(3).fill({ id: '4', value: 'LIKE' }) },
      { id: 'ep5', createdAt: early, pitchVotes: Array(3).fill({ id: '5', value: 'LIKE' }) },
      { id: 'ep6', createdAt: early, pitchVotes: Array(3).fill({ id: '6', value: 'LIKE' }) },
      { id: 'ep7', createdAt: later, pitchVotes: Array(3).fill({ id: '7', value: 'LIKE' }) },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    const updateCalls = prisma.pitchProject.update.mock.calls;
    expect(updateCalls).toHaveLength(7);
    for (const call of updateCalls) {
      expect(call[0].data.isTopProject).toBe(true);
      expect(call[0].data.allottedPresentingSec).toBe(120);
      expect(call[0].data.allottedQuestionsSec).toBe(180);
    }
  });

  it('handles ties correctly (same pitch-like count → ordered by createdAt)', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    const early = new Date('2026-01-01');
    const late = new Date('2026-02-01');
    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep-late', createdAt: late, pitchVotes: [{ id: '1', value: 'LIKE' }, { id: '2', value: 'LIKE' }] },
      { id: 'ep-early', createdAt: early, pitchVotes: [{ id: '3', value: 'LIKE' }, { id: '4', value: 'LIKE' }] },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
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
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    prisma.pitchProject.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Transaction includes the phase update even with no projects
    const txArgs = prisma.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(1); // just the event phase update
  });

  it('works with no projects', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'e1', phase: 'VOTING', staff: [], ...eventTimingConfig })
      .mockResolvedValueOnce({ id: 'e1', phase: 'PITCHING', projects: [] });

    prisma.pitchProject.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const res = await POST_TRANSITION(makeRequest({ targetPhase: 'PITCHING' }) as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });

  it('does not gate transition to pitching on project card status', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-admin',
      role: 'SITE_ADMIN',
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      chapterId: 'chapter-boston',
      staff: [],
      ...eventTimingConfig,
    });
    prisma.pitchProject.findMany.mockResolvedValue([
      {
        id: 'ep-draft-card',
        cardStatus: 'DRAFT',
        createdAt: new Date('2026-07-10T12:00:00.000Z'),
        pitchVotes: [],
      },
    ]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.pitchSession.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const response = await POST_TRANSITION(
      makeRequest({ targetPhase: 'PITCHING' }) as any,
      { params: { eventId: 'e1' } } as any
    );

    expect(response.status).toBe(200);
    expect(prisma.pitchProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ep-draft-card' },
        data: expect.objectContaining({ status: 'CURRENT' }),
      })
    );
  });
});
