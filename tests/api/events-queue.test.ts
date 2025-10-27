import { NextRequest } from 'next/server';
import { POST as POST_JOIN, PATCH as PATCH_REORDER } from '../../src/app/api/events/[eventId]/queue/route';
import { PATCH as PATCH_STATUS } from '../../src/app/api/events/queue/[eventProjectId]/status/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    eventProject: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
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
    prisma.event.findUnique.mockResolvedValue({ id: 'e1', audienceCanReorder: false });
    const request = new NextRequest('http://localhost:3000/api/events/e1/queue', { method: 'PATCH' });
    request.json = jest.fn().mockResolvedValue({ items: [] });
    const res = await PATCH_REORDER(request as any, { params: { eventId: 'e1' } } as any);
    expect(res.status).toBe(401);
  });
});


