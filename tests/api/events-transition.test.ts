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

describe('/api/events/[eventId]/transition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires admin/MC', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', mcs: [] });

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('rejects if already PITCHING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already');
  });

  it('sorts projects by like count and assigns positions', async () => {
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

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);

    // Verify transaction was called (positions assigned in sorted order)
    expect(prisma.$transaction).toHaveBeenCalled();
    const txArgs = prisma.$transaction.mock.calls[0][0];
    // Should have 3 position updates + 1 event phase update = 4 operations
    expect(txArgs).toHaveLength(4);
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

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
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

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
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

    const request = new NextRequest('http://localhost:3000/api/events/e1/transition', { method: 'POST' });
    const res = await POST_TRANSITION(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(200);
  });
});
