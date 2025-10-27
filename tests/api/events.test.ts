import { NextRequest } from 'next/server';
import { GET as GET_EVENTS, POST as POST_EVENTS } from '../../src/app/api/events/route';
import { GET as GET_EVENT } from '../../src/app/api/events/[eventId]/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
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
});

describe('/api/events/[eventId]', () => {
  it('GET returns 404 when missing', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    const request = new NextRequest('http://localhost:3000/api/events/evt-1');
    const res = await GET_EVENT(request as any, { params: { eventId: 'evt-1' } } as any);
    expect(res.status).toBe(404);
  });
});


