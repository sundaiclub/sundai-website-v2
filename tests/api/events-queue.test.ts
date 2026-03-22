import { NextRequest } from 'next/server';
import { POST as POST_JOIN, PATCH as PATCH_REORDER } from '../../src/app/api/events/[eventId]/queue/route';
import { PATCH as PATCH_STATUS } from '../../src/app/api/events/queue/[eventProjectId]/status/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    eventProject: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    projectLike: { upsert: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('queue endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('join requires auth', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('status patch requires admin', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ role: 'HACKER' });
    const request = new NextRequest('http://localhost:3000/api/events/queue/ep1/status', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ status: 'APPROVED' });
    const res = await PATCH_STATUS(request as any, { params: { eventProjectId: 'ep1' } } as any);
    expect(res.status).toBe(401);
  });

  it('reorder rejects when audience disabled and not admin', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: false, phase: 'PITCHING' });
    // Mock for top-group check (fewer than 5 projects → no top group)
    prisma.eventProject.findMany.mockResolvedValue([]);
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('join queue auto-creates ProjectLike for submitting user', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING' });
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      launchLeadId: 'h1',
      participants: [],
    });
    prisma.eventProject.findUnique.mockResolvedValue(null);
    prisma.eventProject.findFirst.mockResolvedValue(null);
    prisma.eventProject.create.mockResolvedValue({ id: 'ep1', eventId: 'e1', projectId: 'p1', position: 1 });
    prisma.projectLike.upsert.mockResolvedValue({ id: 'like1' });

    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.projectLike.upsert).toHaveBeenCalledWith({
      where: { projectId_hackerId: { projectId: 'p1', hackerId: 'h1' } },
      create: { projectId: 'p1', hackerId: 'h1' },
      update: {},
    });
  });

  it('join queue works in both VOTING and PITCHING phases', async () => {
    for (const phase of ['VOTING', 'PITCHING']) {
      jest.clearAllMocks();
      mockAuth.mockReturnValue({ userId: 'clerk-1' });
      prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase });
      prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        launchLeadId: 'h1',
        participants: [],
      });
      prisma.eventProject.findUnique.mockResolvedValue(null);
      prisma.eventProject.findFirst.mockResolvedValue({ position: 5 });
      prisma.eventProject.create.mockResolvedValue({ id: 'ep1', eventId: 'e1', projectId: 'p1', position: 6 });
      prisma.projectLike.upsert.mockResolvedValue({ id: 'like1' });

      const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'POST' });
      request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
      const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);
      expect(res.status).toBe(200);
    }
  });

  it('PITCHING join appends to end position', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING' });
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      launchLeadId: 'h1',
      participants: [],
    });
    prisma.eventProject.findUnique.mockResolvedValue(null);
    prisma.eventProject.findFirst.mockResolvedValue({ position: 10 });
    prisma.eventProject.create.mockResolvedValue({ id: 'ep1', eventId: 'e1', projectId: 'p1', position: 11 });
    prisma.projectLike.upsert.mockResolvedValue({ id: 'like1' });

    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.eventProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 11 }),
    });
  });

  it('reorder rejects moving top-group projects in PITCHING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    // 6 projects, top 5 by likes threshold = 2 likes at rank 5
    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, project: { likes: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }] } },
      { id: 'ep2', position: 2, project: { likes: [{ id: '6' }, { id: '7' }, { id: '8' }, { id: '9' }] } },
      { id: 'ep3', position: 3, project: { likes: [{ id: '10' }, { id: '11' }, { id: '12' }] } },
      { id: 'ep4', position: 4, project: { likes: [{ id: '13' }, { id: '14' }] } },
      { id: 'ep5', position: 5, project: { likes: [{ id: '15' }, { id: '16' }] } },
      { id: 'ep6', position: 6, project: { likes: [{ id: '17' }] } },
    ]);

    // Try to move ep1 (top-group) — should be rejected
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep1', position: 6 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('top-group');
  });

  it('reorder rejects moving non-top projects into top-group positions', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, project: { likes: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }] } },
      { id: 'ep2', position: 2, project: { likes: [{ id: '6' }, { id: '7' }, { id: '8' }, { id: '9' }] } },
      { id: 'ep3', position: 3, project: { likes: [{ id: '10' }, { id: '11' }, { id: '12' }] } },
      { id: 'ep4', position: 4, project: { likes: [{ id: '13' }, { id: '14' }] } },
      { id: 'ep5', position: 5, project: { likes: [{ id: '15' }, { id: '16' }] } },
      { id: 'ep6', position: 6, project: { likes: [{ id: '17' }] } },
    ]);

    // Try to move ep6 into position 1 (top-group position) — should be rejected
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep6', position: 1 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('top-group');
  });

  it('reorder allows moving non-top projects among themselves', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    prisma.eventProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, project: { likes: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }] } },
      { id: 'ep2', position: 2, project: { likes: [{ id: '6' }, { id: '7' }, { id: '8' }, { id: '9' }] } },
      { id: 'ep3', position: 3, project: { likes: [{ id: '10' }, { id: '11' }, { id: '12' }] } },
      { id: 'ep4', position: 4, project: { likes: [{ id: '13' }, { id: '14' }] } },
      { id: 'ep5', position: 5, project: { likes: [{ id: '15' }, { id: '16' }] } },
      { id: 'ep6', position: 6, project: { likes: [{ id: '17' }] } },
      { id: 'ep7', position: 7, project: { likes: [] } },
    ]);

    prisma.eventProject.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    // Move ep6 and ep7 — both non-top, both to non-top positions
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep7', position: 6 }, { id: 'ep6', position: 7 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(204);
  });
});
