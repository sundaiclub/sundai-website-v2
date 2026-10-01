import { createJsonRequest } from '../utils/api-auth';
import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { buildWeeklyEmails, loadWeeklyEmailContent } from '@/lib/weeklyEmails';
import { POST, PATCH } from '@/app/api/admin/weekly-emails/[emailId]/route';
import { GET, POST as CREATE } from '@/app/api/admin/weekly-emails/route';

jest.mock('@/lib/emailQueue', () => ({
  createEmailBatches: jest.fn().mockResolvedValue(['batch-1']),
  publishEmailBatches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/eventManagementApi', () => ({ requireSiteAdmin: jest.fn() }));
jest.mock('@/lib/eventDelivery', () => ({
  getEventDeliveryAvailability: () => ({ email: true }),
}));
jest.mock('@/lib/weeklyEmails', () => ({
  ...jest.requireActual('@/lib/weeklyEmails'),
  loadWeeklyEmailContent: jest.fn(),
  buildWeeklyEmails: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    weeklyEmail: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));
const db = prisma.weeklyEmail as unknown as Record<string, jest.Mock>;
const auth = requireSiteAdmin as jest.Mock;
const draft = {
  id: 'draft',
  subject: 'News',
  body: 'Welcome',
  status: 'DRAFT',
  updatedAt: new Date(),
};
const context = { params: { emailId: 'draft' } };
const request = (action: string) =>
  createJsonRequest('http://localhost/api/admin/weekly-emails/draft', {
    method: 'POST',
    body: { action },
  });

describe('weekly email routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({
      hacker: { id: 'admin', email: 'admin@example.com' },
      response: null,
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async operation =>
      operation(prisma)
    );
    db.findUnique.mockResolvedValue(draft);
    db.updateMany.mockResolvedValue({ count: 1 });
    (loadWeeklyEmailContent as jest.Mock).mockResolvedValue({
      recipients: [{ id: 'user' }],
      projects: [],
    });
    (buildWeeklyEmails as jest.Mock).mockReturnValue([
      { to: 'admin@example.com', subject: 'News', body: 'Welcome' },
    ]);
  });

  it.each([401, 403])(
    'blocks all operations with authorization status %s',
    async status => {
      auth.mockResolvedValue({
        hacker: null,
        response: new NextResponse(null, { status }),
      });
      expect((await GET()).status).toBe(status);
      expect((await CREATE(request('save'))).status).toBe(status);
      expect((await PATCH(request('save'), context)).status).toBe(status);
      expect((await POST(request('send'), context)).status).toBe(status);
      expect(db.findUnique).not.toHaveBeenCalled();
    }
  );

  it('tests only the signed-in admin without claiming or consuming the draft', async () => {
    expect((await POST(request('test'), context)).status).toBe(202);
    expect(loadWeeklyEmailContent).toHaveBeenCalledWith(
      expect.any(Date),
      'admin'
    );
    expect(buildWeeklyEmails).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '[Test] News' }),
      expect.anything()
    );
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('claims the draft and creates durable batches in the same transaction', async () => {
    expect((await POST(request('send'), context)).status).toBe(202);
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft', status: 'DRAFT', updatedAt: draft.updatedAt },
      data: { status: 'SENDING' },
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(require('@/lib/emailQueue').createEmailBatches).toHaveBeenCalledWith(
      prisma,
      expect.any(Array),
      { weeklyEmailId: 'draft' }
    );
  });

  it('does not send when another request already claimed or edited the draft', async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request('send'), context)).status).toBe(409);
    expect(
      require('@/lib/emailQueue').createEmailBatches
    ).not.toHaveBeenCalled();
  });

  it('does not consume a draft when the audience is empty', async () => {
    (loadWeeklyEmailContent as jest.Mock).mockResolvedValue({
      recipients: [],
      projects: [],
    });
    expect((await POST(request('send'), context)).status).toBe(400);
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it('retains saved batches and their IDs when queue publication fails', async () => {
    require('@/lib/emailQueue').publishEmailBatches.mockRejectedValueOnce(new Error('Queue unavailable'));
    const response = await POST(request('send'), context);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ batchIds: ['batch-1'], warning: expect.stringContaining('Resume queued emails') });
    expect(db.update).not.toHaveBeenCalled();
  });
});
