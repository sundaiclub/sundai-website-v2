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

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/events/e1/pitch/timer', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = { params: { pitchSessionId: 'ps1' } } as any;

describe('/api/events/[eventId]/pitch-timer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'PITCHING',
      topPresentingSec: 120,
      topQuestionsSec: 180,
      defaultPresentingSec: 60,
      defaultQuestionsSec: 120,
    });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(401);
  });

  it('rejects non-site-admin/non-staff users', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(401);
  });

  it('rejects if event is not in PITCHING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', staff: [] });
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'ps1',
      eventId: 'e1',
      phase: 'VOTING',
      topPresentingSec: 120,
      topQuestionsSec: 180,
      defaultPresentingSec: 60,
      defaultQuestionsSec: 120,
    });

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PITCHING');
  });

  it('rejects if event project is not CURRENT', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'QUEUED', pitchPhase: 'WAITING' });

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('CURRENT');
  });

  it('starts presenting from WAITING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('PRESENTING');
    expect(updateCall.data.presentingStartedAt).toBeDefined();
  });

  it('backfills allotted time from the frozen top-project flag', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({
      id: 'e1',
      phase: 'PITCHING',
      staff: [],
      topPresentingSec: 120,
      topQuestionsSec: 180,
      defaultPresentingSec: 60,
      defaultQuestionsSec: 120,
    });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      status: 'CURRENT',
      pitchPhase: 'WAITING',
      isTopProject: true,
      allottedPresentingSec: null,
      allottedQuestionsSec: null,
    });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.allottedPresentingSec).toBe(120);
    expect(updateCall.data.allottedQuestionsSec).toBe(180);
  });

  it('rejects start_presenting if not in WAITING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING' });

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already');
  });

  it('starts questions from PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING' });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_questions', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('QUESTIONS');
    expect(updateCall.data.questionsStartedAt).toBeDefined();
  });

  it('rejects start_questions if not PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });

    const res = await POST(makeRequest({ action: 'start_questions', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
  });

  it('finishes from QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'QUESTIONS' });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'finish', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('COMPLETED');
    expect(updateCall.data.completedAt).toBeDefined();
  });

  it('rejects finish if not in QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING' });

    const res = await POST(makeRequest({ action: 'finish', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
  });

  it('rejects invalid action', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });

    const res = await POST(makeRequest({ action: 'invalid_action', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid');
  });

  it('allows MC to control timer', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [{ hackerId: 'h-mc', role: 'MC' }] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);
  });

  it('allows co-MC to control timer', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-co-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-co-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [{ hackerId: 'h-co-mc', role: 'CO_MC' }] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);
  });

  it('pauses during PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING',
      presentingStartedAt: new Date(), questionsStartedAt: null, pausedAt: null,
    });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'pause', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.pausedAt).toBeInstanceOf(Date);
  });

  it('rejects pause when not PRESENTING or QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'WAITING', pausedAt: null,
    });

    const res = await POST(makeRequest({ action: 'pause', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PRESENTING');
  });

  it('rejects pause when already paused', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING',
      presentingStartedAt: new Date(), pausedAt: new Date(),
    });

    const res = await POST(makeRequest({ action: 'pause', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already paused');
  });

  it('resume shifts presentingStartedAt forward by paused duration', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });

    const presStart = new Date('2026-05-06T16:00:00Z');
    const pausedAt = new Date('2026-05-06T16:00:30Z'); // 30s after start
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING',
      presentingStartedAt: presStart, questionsStartedAt: null, pausedAt,
    });
    prisma.pitchProject.update.mockResolvedValue({});

    const before = Date.now();
    const res = await POST(makeRequest({ action: 'resume', pitchProjectId: 'ep1' }) as any, params);
    const after = Date.now();
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    expect(updateCall.data.pausedAt).toBeNull();
    const expectedShiftLow = before - pausedAt.getTime();
    const expectedShiftHigh = after - pausedAt.getTime();
    const actualShift = updateCall.data.presentingStartedAt.getTime() - presStart.getTime();
    expect(actualShift).toBeGreaterThanOrEqual(expectedShiftLow);
    expect(actualShift).toBeLessThanOrEqual(expectedShiftHigh);
    expect(updateCall.data.questionsStartedAt).toBeUndefined();
  });

  it('resume also shifts questionsStartedAt when present', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });

    const presStart = new Date('2026-05-06T16:00:00Z');
    const qStart = new Date('2026-05-06T16:02:00Z');
    const pausedAt = new Date('2026-05-06T16:03:00Z');
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'QUESTIONS',
      presentingStartedAt: presStart, questionsStartedAt: qStart, pausedAt,
    });
    prisma.pitchProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'resume', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.pitchProject.update.mock.calls[0][0];
    const presShift = updateCall.data.presentingStartedAt.getTime() - presStart.getTime();
    const qShift = updateCall.data.questionsStartedAt.getTime() - qStart.getTime();
    expect(presShift).toBe(qShift);
    expect(presShift).toBeGreaterThan(0);
  });

  it('rejects resume when not paused', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING',
      presentingStartedAt: new Date(), pausedAt: null,
    });

    const res = await POST(makeRequest({ action: 'resume', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('not paused');
  });

  it('rejects start_questions while paused', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'PRESENTING',
      presentingStartedAt: new Date(), pausedAt: new Date(),
    });

    const res = await POST(makeRequest({ action: 'start_questions', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Resume');
  });

  it('rejects finish while paused', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1', pitchSessionId: 'ps1', status: 'CURRENT', pitchPhase: 'QUESTIONS',
      questionsStartedAt: new Date(), pausedAt: new Date(),
    });

    const res = await POST(makeRequest({ action: 'finish', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Resume');
  });

  it('rejects event project from different event', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'SITE_ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', staff: [] });
    prisma.pitchProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e2', status: 'CURRENT', pitchPhase: 'WAITING' });

    const res = await POST(makeRequest({ action: 'start_presenting', pitchProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(404);
  });
});
