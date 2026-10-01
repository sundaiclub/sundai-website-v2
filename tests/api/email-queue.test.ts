import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { publishEmailBatches } from '@/lib/emailQueue';
import { POST } from '@/app/api/admin/email-queue/route';
import { NextResponse } from 'next/server';

jest.mock('@/lib/eventManagementApi', () => ({ requireSiteAdmin: jest.fn() }));
jest.mock('@/lib/emailQueue', () => ({ publishEmailBatches: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { emailDeliveryBatch: { findMany: jest.fn() } } }));

beforeEach(() => {
  jest.resetAllMocks();
  (requireSiteAdmin as jest.Mock).mockResolvedValue({ response: null });
  (prisma.emailDeliveryBatch.findMany as jest.Mock).mockResolvedValue([{ id: 'never-started' }]);
});

it.each([401, 403])('blocks queue recovery for authorization status %s', async status => {
  (requireSiteAdmin as jest.Mock).mockResolvedValue({ response: new NextResponse(null, { status }) });
  expect((await POST()).status).toBe(status);
  expect(prisma.emailDeliveryBatch.findMany).not.toHaveBeenCalled();
  expect(publishEmailBatches).not.toHaveBeenCalled();
});

it('republishes only never-started batches and never resets attempted work', async () => {
  expect((await POST()).status).toBe(200);
  expect(prisma.emailDeliveryBatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'QUEUED' }, take: 500 }));
  expect(publishEmailBatches).toHaveBeenCalledWith(['never-started']);
});

it('reports a queue outage while leaving saved work pending', async () => {
  (publishEmailBatches as jest.Mock).mockRejectedValue(new Error('Unavailable'));
  const response = await POST();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ message: expect.stringContaining('Saved emails remain pending') });
});
