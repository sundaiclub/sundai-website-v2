import {
  GET,
  POST,
} from '../../src/app/api/events/[eventId]/staff/invitations/route';
import { DELETE } from '../../src/app/api/events/[eventId]/staff/invitations/[invitationId]/route';
import { POST as ACCEPT } from '../../src/app/api/events/staff-invitations/[invitationId]/accept/route';
import { createJsonRequest } from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
}));
jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventStaffManager: jest.fn(),
  badRequest: (message: string) =>
    require('next/server').NextResponse.json({ message }, { status: 400 }),
}));
jest.mock('../../src/lib/eventDelivery', () => ({ sendEventEmail: jest.fn() }));
jest.mock('../../src/lib/eventStaffRegistrations', () => ({
  approveEventStaffRegistrations: jest.fn(),
}));
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    eventStaffInvitation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    hacker: { findUnique: jest.fn() },
    eventStaff: { findUnique: jest.fn(), upsert: jest.fn() },
    eventStaffAudit: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;
const { auth, currentUser } = require('@clerk/nextjs/server');
const {
  requireEventStaffManager,
} = require('../../src/lib/eventManagementApi');
const { sendEventEmail } = require('../../src/lib/eventDelivery');
const {
  approveEventStaffRegistrations,
} = require('../../src/lib/eventStaffRegistrations');
const params = { eventId: 'event-1' };
const invitation = {
  id: 'invite-1',
  eventId: params.eventId,
  email: 'new@example.com',
  invitedById: 'mc-1',
  expiresAt: new Date(Date.now() + 86400000),
  acceptedAt: null,
  acceptedById: null,
  revokedAt: null,
};
const accept = () =>
  ACCEPT(
    createJsonRequest('/api/events/staff-invitations/invite-1/accept', {
      method: 'POST',
    }),
    { params: { invitationId: invitation.id } }
  );

beforeEach(() => {
  jest.resetAllMocks();
  requireEventStaffManager.mockResolvedValue({
    hacker: { id: 'mc-1' },
    event: { id: params.eventId, title: 'Build Night' },
    administrator: false,
    response: null,
  });
  auth.mockReturnValue({ userId: 'clerk-new' });
  currentUser.mockResolvedValue({
    id: 'clerk-new',
    emailAddresses: [
      { emailAddress: 'New@Example.com', verification: { status: 'verified' } },
    ],
  });
  prisma.hacker.findUnique.mockResolvedValue({ id: 'hacker-new' });
  prisma.eventStaffInvitation.findUnique.mockResolvedValue(invitation);
  prisma.eventStaffInvitation.upsert.mockResolvedValue(invitation);
  prisma.eventStaffInvitation.updateMany.mockResolvedValue({ count: 1 });
  prisma.eventStaff.findUnique.mockResolvedValue(null);
  prisma.eventStaff.upsert.mockResolvedValue({ role: 'CO_MC' });
  prisma.$transaction.mockImplementation((operation: any) => operation(prisma));
  sendEventEmail.mockResolvedValue({ status: 'SENT' });
});

it('sends an invite for an email without creating an account or staff record', async () => {
  const response = await POST(
    createJsonRequest('/api/events/event-1/staff/invitations', {
      body: { email: '  NEW@example.com ' },
      origin: 'https://sundai.example',
    }),
    { params }
  );
  expect(response.status).toBe(201);
  expect(prisma.eventStaffInvitation.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        eventId_email: { eventId: 'event-1', email: 'new@example.com' },
      },
      create: expect.objectContaining({
        email: 'new@example.com',
        invitedById: 'mc-1',
      }),
    })
  );
  expect(sendEventEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'new@example.com',
      body: expect.stringContaining(
        'https://sundai.example/events/staff-invitations/invite-1'
      ),
    })
  );
  expect(prisma.hacker.findUnique).not.toHaveBeenCalled();
  expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
});

it.each(['', 'not-an-email', 'a@b.com\nBcc: victim@example.com'])(
  'rejects an invalid email: %s',
  async email => {
    const response = await POST(
      createJsonRequest('/api/events/event-1/staff/invitations', {
        body: { email },
      }),
      { params }
    );
    expect(response.status).toBe(400);
    expect(sendEventEmail).not.toHaveBeenCalled();
  }
);

it('reports failed email delivery and returns a usable invite link', async () => {
  sendEventEmail.mockResolvedValue({ status: 'FAILED' });
  const response = await POST(
    createJsonRequest('/api/events/event-1/staff/invitations', {
      body: { email: invitation.email },
    }),
    { params }
  );
  expect((await response.json()).delivery).toMatchObject({
    sent: false,
    link: expect.stringContaining('/events/staff-invitations/invite-1'),
  });
});

it('denies invite operations when the actor cannot assign staff', async () => {
  requireEventStaffManager.mockImplementation(async () => ({
    response: new Response(null, { status: 403 }),
  }));
  expect((await GET(createJsonRequest('/'), { params })).status).toBe(403);
  expect(
    (
      await POST(
        createJsonRequest('/', { body: { email: invitation.email } }),
        { params }
      )
    ).status
  ).toBe(403);
  expect(
    (
      await DELETE(createJsonRequest('/'), {
        params: { ...params, invitationId: invitation.id },
      })
    ).status
  ).toBe(403);
  expect(prisma.eventStaffInvitation.upsert).not.toHaveBeenCalled();
});

it('limits cancellation to a pending invite for this event', async () => {
  expect(
    (
      await DELETE(createJsonRequest('/'), {
        params: { ...params, invitationId: invitation.id },
      })
    ).status
  ).toBe(204);
  expect(prisma.eventStaffInvitation.updateMany).toHaveBeenCalledWith({
    where: {
      id: invitation.id,
      eventId: params.eventId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: expect.any(Date) },
  });
});

it('requires sign-in before granting access', async () => {
  auth.mockReturnValue({ userId: null });
  expect((await accept()).status).toBe(401);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it.each([
  {
    emailAddresses: [
      {
        emailAddress: 'other@example.com',
        verification: { status: 'verified' },
      },
    ],
  },
  {
    emailAddresses: [
      {
        emailAddress: invitation.email,
        verification: { status: 'unverified' },
      },
    ],
  },
])('requires a verified matching email', async ({ emailAddresses }) => {
  currentUser.mockResolvedValue({ id: 'clerk-new', emailAddresses });
  expect((await accept()).status).toBe(403);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('allows a retry while the account creation webhook is pending', async () => {
  prisma.hacker.findUnique.mockResolvedValue(null);
  expect((await accept()).status).toBe(409);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('grants event-scoped co-MC access after verified account creation', async () => {
  const response = await accept();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    workspaceUrl: '/organizer/events/event-1',
  });
  expect(prisma.eventStaff.upsert).toHaveBeenCalledWith({
    where: { eventId_hackerId: { eventId: 'event-1', hackerId: 'hacker-new' } },
    create: { eventId: 'event-1', hackerId: 'hacker-new', role: 'CO_MC' },
    update: {},
  });
  expect(prisma.eventStaffAudit.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'ASSIGNED',
      actorId: 'mc-1',
      toRole: 'CO_MC',
    }),
  });
  expect(approveEventStaffRegistrations).toHaveBeenCalledWith(prisma, {
    eventId: 'event-1',
    hackerIds: ['hacker-new'],
    actorId: 'mc-1',
  });
});

it('preserves an existing MC assignment', async () => {
  prisma.eventStaff.findUnique.mockResolvedValue({ role: 'MC' });
  expect((await accept()).status).toBe(200);
  expect(prisma.eventStaff.upsert.mock.calls[0][0].update).toEqual({});
  expect(prisma.eventStaffAudit.create).not.toHaveBeenCalled();
});

it('rejects expired, revoked, or concurrently claimed invites', async () => {
  prisma.eventStaffInvitation.updateMany.mockResolvedValue({ count: 0 });
  expect((await accept()).status).toBe(410);
  expect(prisma.eventStaffInvitation.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      }),
    })
  );
  expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
});

it('does not restore removed access when an accepted link is opened again', async () => {
  prisma.eventStaffInvitation.findUnique.mockResolvedValue({
    ...invitation,
    acceptedAt: new Date(),
    acceptedById: 'hacker-new',
  });
  expect((await accept()).status).toBe(410);
  expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
});

it('handles a second acceptance request from the same recipient', async () => {
  prisma.eventStaffInvitation.findUnique
    .mockResolvedValueOnce(invitation)
    .mockResolvedValueOnce({
      ...invitation,
      acceptedAt: new Date(),
      acceptedById: 'hacker-new',
    });
  prisma.eventStaffInvitation.updateMany.mockResolvedValue({ count: 0 });
  prisma.eventStaff.findUnique.mockResolvedValue({ role: 'CO_MC' });
  expect((await accept()).status).toBe(200);
  expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
});

it('returns the workspace when the same recipient opens an accepted link', async () => {
  prisma.eventStaffInvitation.findUnique.mockResolvedValue({
    ...invitation,
    acceptedAt: new Date(),
    acceptedById: 'hacker-new',
  });
  prisma.eventStaff.findUnique.mockResolvedValue({ role: 'CO_MC' });
  expect((await accept()).status).toBe(200);
  expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
});
