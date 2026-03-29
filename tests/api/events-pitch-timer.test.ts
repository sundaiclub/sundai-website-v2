import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/events/[eventId]/pitch-timer/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventProject: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/events/e1/pitch-timer', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = { params: { eventId: 'e1' } } as any;

describe('/api/events/[eventId]/pitch-timer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(401);
  });

  it('rejects non-admin/MC users', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(401);
  });

  it('rejects if event is not in PITCHING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'VOTING', mcs: [] });

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('PITCHING');
  });

  it('rejects if event project is not CURRENT', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'QUEUED', pitchPhase: 'WAITING' });

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('CURRENT');
  });

  it('starts presenting from WAITING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });
    prisma.eventProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.eventProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('PRESENTING');
    expect(updateCall.data.presentingStartedAt).toBeDefined();
  });

  it('backfills allotted time from the frozen top-project flag', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({
      id: 'ep1',
      eventId: 'e1',
      status: 'CURRENT',
      pitchPhase: 'WAITING',
      isTopProject: true,
      allottedPresentingSec: null,
      allottedQuestionsSec: null,
    });
    prisma.eventProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.eventProject.update.mock.calls[0][0];
    expect(updateCall.data.allottedPresentingSec).toBe(120);
    expect(updateCall.data.allottedQuestionsSec).toBe(180);
  });

  it('rejects start_presenting if not in WAITING phase', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'PRESENTING' });

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('already');
  });

  it('starts questions from PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'PRESENTING' });
    prisma.eventProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_questions', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.eventProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('QUESTIONS');
    expect(updateCall.data.questionsStartedAt).toBeDefined();
  });

  it('rejects start_questions if not PRESENTING', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });

    const res = await POST(makeRequest({ action: 'start_questions', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
  });

  it('finishes from QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'QUESTIONS' });
    prisma.eventProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'finish', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);

    const updateCall = prisma.eventProject.update.mock.calls[0][0];
    expect(updateCall.data.pitchPhase).toBe('COMPLETED');
    expect(updateCall.data.completedAt).toBeDefined();
  });

  it('rejects finish if not in QUESTIONS', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'PRESENTING' });

    const res = await POST(makeRequest({ action: 'finish', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
  });

  it('rejects invalid action', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });

    const res = await POST(makeRequest({ action: 'invalid_action', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid');
  });

  it('allows MC to control timer', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-mc', role: 'HACKER' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [{ hackerId: 'h-mc' }] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e1', status: 'CURRENT', pitchPhase: 'WAITING', allottedPresentingSec: 120, allottedQuestionsSec: 180 });
    prisma.eventProject.update.mockResolvedValue({});

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(200);
  });

  it('rejects event project from different event', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', phase: 'PITCHING', mcs: [] });
    prisma.eventProject.findUnique.mockResolvedValue({ id: 'ep1', eventId: 'e2', status: 'CURRENT', pitchPhase: 'WAITING' });

    const res = await POST(makeRequest({ action: 'start_presenting', eventProjectId: 'ep1' }) as any, params);
    expect(res.status).toBe(404);
  });
});
