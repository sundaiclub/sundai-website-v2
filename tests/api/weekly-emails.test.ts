import { createJsonRequest } from '../utils/api-auth';
import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { deliverWeeklyEmail, loadWeeklyEmailContent } from '@/lib/weeklyEmails';
import { POST, PATCH } from '@/app/api/admin/weekly-emails/[emailId]/route';
import { GET, POST as CREATE } from '@/app/api/admin/weekly-emails/route';

jest.mock('@/lib/eventManagementApi', () => ({ requireSiteAdmin: jest.fn() }));
jest.mock('@/lib/eventDelivery', () => ({
  getEventDeliveryAvailability: () => ({ email: true }),
}));
jest.mock('@/lib/weeklyEmails', () => ({
  ...jest.requireActual('@/lib/weeklyEmails'),
  loadWeeklyEmailContent: jest.fn(),
  deliverWeeklyEmail: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
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
    db.findUnique.mockResolvedValue(draft);
    db.updateMany.mockResolvedValue({ count: 1 });
    (loadWeeklyEmailContent as jest.Mock).mockResolvedValue({
      recipients: [{ id: 'user' }],
      projects: [],
    });
    (deliverWeeklyEmail as jest.Mock).mockResolvedValue({ sent: 1, failed: 0 });
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
    expect((await POST(request('test'), context)).status).toBe(200);
    expect(loadWeeklyEmailContent).toHaveBeenCalledWith(
      expect.any(Date),
      'admin'
    );
    expect(deliverWeeklyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '[Test] News' }),
      expect.anything()
    );
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('claims a draft before sending and does not store recipient tracking', async () => {
    expect((await POST(request('send'), context)).status).toBe(200);
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft', status: 'DRAFT', updatedAt: draft.updatedAt },
      data: { status: 'SENDING' },
    });
    expect(db.update).toHaveBeenCalledWith({
      where: { id: 'draft' },
      data: { status: 'SENT' },
    });
  });

  it('does not send when another request already claimed or edited the draft', async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request('send'), context)).status).toBe(409);
    expect(deliverWeeklyEmail).not.toHaveBeenCalled();
  });

  it('does not consume a draft when the audience is empty', async () => {
    (loadWeeklyEmailContent as jest.Mock).mockResolvedValue({
      recipients: [],
      projects: [],
    });
    expect((await POST(request('send'), context)).status).toBe(400);
    expect(db.updateMany).not.toHaveBeenCalled();
  });
});
