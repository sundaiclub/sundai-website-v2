import { NextRequest } from 'next/server';
import { POST as POST_JOIN, PATCH as PATCH_REORDER } from '../../src/app/api/events/[eventId]/pitch/queue/route';
import { PATCH as PATCH_STATUS } from '../../src/app/api/events/[eventId]/pitch/queue/[pitchProjectId]/status/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    event: { findUnique: jest.fn() },
    pitchSession: { findFirst: jest.fn() },
    eventProject: { upsert: jest.fn() },
    project: { findUnique: jest.fn() },
    pitchProject: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('queue endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'PITCHING',
      audienceCanReorder: true,
      defaultPitchSec: 180,
    });
    prisma.eventProject.upsert.mockResolvedValue({ id: 'event-project-1' });
  });

  it('join requires auth', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('status patch requires site admin or assigned event staff', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      chapterId: 'chapter-boston',
      staff: [],
    });
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/status', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ status: 'APPROVED' });
    const res = await PATCH_STATUS(request as any, { params: { eventId: 'e1', pitchProjectId: 'ep1' } } as any);
    expect(res.status).toBe(403);
  });

  it('allows assigned EventStaff MCs to update queue item status', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      chapterId: 'chapter-boston',
      staff: [{ role: 'MC' }],
    });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSession: {
        eventId: 'e1',
        event: { staff: [{ hackerId: 'h-mc', role: 'MC' }] },
      },
    });
    prisma.pitchProject.update.mockResolvedValue({ id: 'ep1', status: 'APPROVED' });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/status', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ status: 'APPROVED' });
    const res = await PATCH_STATUS(request as any, { params: { eventId: 'e1', pitchProjectId: 'ep1' } } as any);
    expect(res.status).toBe(200);
  });

  it('allows assigned EventStaff co-MCs to update queue item status', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-co-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      chapterId: 'chapter-boston',
      staff: [{ role: 'CO_MC' }],
    });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSession: {
        eventId: 'e1',
        event: { staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }] },
      },
    });
    prisma.pitchProject.update.mockResolvedValue({ id: 'ep1', status: 'APPROVED' });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/status', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ status: 'APPROVED' });
    const res = await PATCH_STATUS(request as any, { params: { eventId: 'e1', pitchProjectId: 'ep1' } } as any);
    expect(res.status).toBe(200);
  });

  it('reorder rejects when audience disabled and not admin', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', staff: [] });
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'PITCHING',
      audienceCanReorder: false,
      defaultPitchSec: 180,
    });
    // Mock for top-group check (fewer than 5 projects → no top group)
    prisma.pitchProject.findMany.mockResolvedValue([]);
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });

  it('join queue creates an event entry without changing project likes', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING' });
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      launchLeadId: 'h1',
      participants: [],
    });
    prisma.pitchProject.findUnique.mockResolvedValue(null);
    prisma.pitchProject.findFirst.mockResolvedValue(null);
    prisma.pitchProject.create.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', projectId: 'p1', position: 1 });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.eventProject.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_projectId: { eventId: 'e1', projectId: 'p1' } },
      })
    );
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
      prisma.pitchProject.findUnique.mockResolvedValue(null);
      prisma.pitchProject.findFirst.mockResolvedValue({ position: 5 });
      prisma.pitchProject.create.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', projectId: 'p1', position: 6 });

      const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
      request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
      const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);
      expect(res.status).toBe(200);
    }
  });

  it('PITCHING join is always created as a non-top project with default times', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'PITCHING',
      defaultPitchSec: 180,
    });
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      launchLeadId: 'h1',
      participants: [],
    });
    prisma.pitchProject.findUnique.mockResolvedValue(null);
    prisma.pitchProject.findFirst.mockResolvedValue({ position: 5 });
    prisma.pitchProject.create.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', projectId: 'p1', position: 6 });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.pitchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        position: 6,
        isTopProject: false,
        allottedSec: 180,
      }),
    });
  });

  it('rejects join queue when event is FINISHED', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'FINISHED',
      audienceCanReorder: true,
      defaultPitchSec: 180,
    });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('finished event');
  });

  it('PITCHING join appends to end position', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', clerkId: 'clerk-1' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'PITCHING',
      defaultPitchSec: 180,
    });
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      launchLeadId: 'h1',
      participants: [],
    });
    prisma.pitchProject.findUnique.mockResolvedValue(null);
    prisma.pitchProject.findFirst.mockResolvedValue({ position: 10 });
    prisma.pitchProject.create.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', projectId: 'p1', position: 11 });

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ projectId: 'p1' });
    const res = await POST_JOIN(request as any, { params: { eventId: 'e1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.pitchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 11 }),
    });
  });

  it('reorder rejects moving top-group projects in PITCHING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, isTopProject: true },
      { id: 'ep2', position: 2, isTopProject: true },
      { id: 'ep3', position: 3, isTopProject: true },
      { id: 'ep4', position: 4, isTopProject: true },
      { id: 'ep5', position: 5, isTopProject: true },
      { id: 'ep6', position: 6, isTopProject: false },
    ]);

    // Try to move ep1 (top-group) — should be rejected
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep1', position: 6 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('top-group');
  });

  it('reorder rejects moving non-top projects into top-group positions', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, isTopProject: true },
      { id: 'ep2', position: 2, isTopProject: true },
      { id: 'ep3', position: 3, isTopProject: true },
      { id: 'ep4', position: 4, isTopProject: true },
      { id: 'ep5', position: 5, isTopProject: true },
      { id: 'ep6', position: 6, isTopProject: false },
    ]);

    // Try to move ep6 into position 1 (top-group position) — should be rejected
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep6', position: 1 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('top-group');
  });

  it('reorder allows moving non-top projects among themselves', async () => {
    mockAuth.mockReturnValue({ userId: 'u1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: true, phase: 'PITCHING' });

    prisma.pitchProject.findMany.mockResolvedValue([
      { id: 'ep1', position: 1, isTopProject: true },
      { id: 'ep2', position: 2, isTopProject: true },
      { id: 'ep3', position: 3, isTopProject: true },
      { id: 'ep4', position: 4, isTopProject: true },
      { id: 'ep5', position: 5, isTopProject: true },
      { id: 'ep6', position: 6, isTopProject: false },
      { id: 'ep7', position: 7, isTopProject: false },
    ]);

    prisma.pitchProject.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    // Move ep6 and ep7 — both non-top, both to non-top positions
    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep7', position: 6 }, { id: 'ep6', position: 7 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(204);
  });

  it('allows assigned EventStaff MCs to reorder when audience reordering is disabled', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      audienceCanReorder: false,
      phase: 'PITCHING',
      staff: [{ hackerId: 'h-mc', role: 'MC' }],
    });
    prisma.pitchProject.findMany
      .mockResolvedValueOnce([{ id: 'ep1', position: 1, isTopProject: false }])
      .mockResolvedValueOnce([{ id: 'ep1', addedById: 'other-hacker', pitchSessionId: 'ps1' }]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep1', position: 2 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(204);
  });

  it('allows assigned EventStaff co-MCs to reorder when audience reordering is disabled', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-co-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      audienceCanReorder: false,
      phase: 'PITCHING',
      staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }],
    });
    prisma.pitchProject.findMany
      .mockResolvedValueOnce([{ id: 'ep1', position: 1, isTopProject: false }])
      .mockResolvedValueOnce([{ id: 'ep1', addedById: 'other-hacker', pitchSessionId: 'ps1' }]);
    prisma.pitchProject.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [{ id: 'ep1', position: 2 }] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(204);
  });

  it('does not gate organizer queue status changes on project card readiness', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-co-mc',
      role: 'HACKER',
    });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep-draft-card',
      cardStatus: 'DRAFT',
      pitchSession: {
        eventId: 'e1',
        event: { staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }] },
      },
    });
    prisma.pitchProject.update.mockResolvedValue({
      id: 'ep-draft-card',
      cardStatus: 'DRAFT',
      status: 'APPROVED',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/events/e1/pitch/queue/ep-draft-card/status',
      { method: 'PATCH' }
    );
    request.json = jest.fn().mockResolvedValue({ status: 'APPROVED' });
    const response = await PATCH_STATUS(request as any, {
      params: { eventId: 'e1', pitchProjectId: 'ep-draft-card' },
    } as any);

    expect(response.status).toBe(200);
    expect(prisma.pitchProject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED' } })
    );
  });
});
