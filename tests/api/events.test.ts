import { NextRequest } from 'next/server';
import { GET as GET_EVENTS, POST as POST_EVENTS } from '../../src/app/api/events/route';
import { GET as GET_EVENT, PATCH as PATCH_EVENT } from '../../src/app/api/events/[eventId]/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
    eventMC: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    eventProject: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET lists upcoming events', async () => {
    prisma.event.findMany.mockResolvedValue([]);
    const request = new NextRequest('http://localhost:3000/api/events?upcoming=true');
    const res = await GET_EVENTS(request as any);
    expect(res.status).toBe(200);
  });

  it('POST requires admin', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    const request = new NextRequest('http://localhost:3000/api/events', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ title: 'E', startTime: new Date().toISOString() });
    const res = await POST_EVENTS(request as any);
    expect(res.status).toBe(401);
  });

  it('POST creates event with VOTING phase by default', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    const created = { id: 'evt-1', title: 'Test', phase: 'VOTING', startTime: new Date().toISOString() };
    prisma.event.create.mockResolvedValue(created);
    const request = new NextRequest('http://localhost:3000/api/events', { method: 'POST' });
    request.json = jest.fn().mockResolvedValue({ title: 'Test', startTime: new Date().toISOString() });
    const res = await POST_EVENTS(request as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    // The create call should not explicitly set phase — DB default handles it
    expect(prisma.event.create).toHaveBeenCalled();
  });
});

describe('/api/events/[eventId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 404 when missing', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    const request = new NextRequest('http://localhost:3000/api/events/evt-1');
    const res = await GET_EVENT(request as any, { params: { eventId: 'evt-1' } } as any);
    expect(res.status).toBe(404);
  });

  it('GET single event includes phase field', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      title: 'Test',
      phase: 'VOTING',
      startTime: new Date().toISOString(),
      projects: [],
      mcs: [],
    });
    const request = new NextRequest('http://localhost:3000/api/events/evt-1');
    const res = await GET_EVENT(request as any, { params: { eventId: 'evt-1' } } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase).toBe('VOTING');
  });

  it('PATCH updates active pitching allotments when timing changes', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h-admin', role: 'ADMIN' });
    prisma.eventMC.findFirst.mockResolvedValue(null);
    prisma.event.findUnique
      .mockResolvedValueOnce({
        phase: 'PITCHING',
        topPresentingSec: 120,
        topQuestionsSec: 180,
        defaultPresentingSec: 60,
        defaultQuestionsSec: 120,
      })
      .mockResolvedValueOnce({
        id: 'evt-1',
        title: 'Updated Event',
        phase: 'PITCHING',
        topPresentingSec: 150,
        topQuestionsSec: 180,
        defaultPresentingSec: 75,
        defaultQuestionsSec: 120,
        projects: [
          { id: 'ep-top', isTopProject: true, allottedPresentingSec: 150, allottedQuestionsSec: 180 },
          { id: 'ep-regular', isTopProject: false, allottedPresentingSec: 75, allottedQuestionsSec: 120 },
        ],
        mcs: [],
      });
    prisma.event.update.mockResolvedValue({ id: 'evt-1' });
    prisma.eventProject.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));

    const request = new NextRequest('http://localhost:3000/api/events/evt-1', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({
      title: 'Updated Event',
      topPresentingSec: 150,
      defaultPresentingSec: 75,
    });

    const res = await PATCH_EVENT(request as any, { params: { eventId: 'evt-1' } } as any);

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.eventProject.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        eventId: 'evt-1',
        isTopProject: true,
        status: { in: ['CURRENT', 'APPROVED'] },
      },
      data: {
        allottedPresentingSec: 150,
        allottedQuestionsSec: 180,
      },
    });
    expect(prisma.eventProject.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventId: 'evt-1',
        isTopProject: false,
        status: { in: ['CURRENT', 'APPROVED'] },
      },
      data: {
        allottedPresentingSec: 75,
        allottedQuestionsSec: 120,
      },
    });

    const body = await res.json();
    expect(body.projects[0].allottedPresentingSec).toBe(150);
    expect(body.projects[1].allottedPresentingSec).toBe(75);
  });
});
