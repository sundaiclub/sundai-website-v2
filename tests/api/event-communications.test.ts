import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  resetClerkMocks,
} from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);
jest.mock('@/lib/emailQueue', () => ({
  createEmailBatches: jest.fn().mockResolvedValue(['batch-1']),
  publishEmailBatches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/eventDelivery', () => ({
  ...jest.requireActual('@/lib/eventDelivery'),
  deliverEventSmsRecipients: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    chapter: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    chapterMembership: { findFirst: jest.fn(), findMany: jest.fn() },
    eventRegistration: { findMany: jest.fn() },
    userBan: { findMany: jest.fn() },
    eventCommunication: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailDeliveryBatch: {
      findMany: jest.fn().mockResolvedValue([{ id: 'batch-1' }]),
    },
    eventCommunicationRecipient: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;
const eventId = 'event-ai-build-night';
const blastId = 'communication-approved-reminder';

const draft = {
  id: blastId,
  eventId,
  createdById: 'hacker-mc',
  sentById: null,
  channel: 'EMAIL',
  status: 'DRAFT',
  subject: 'Build night reminder',
  body: 'Doors open at 9:30.',
  audienceType: 'APPROVED',
  audienceDefinitionJson: {},
  previewFingerprint: null,
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  sentAt: null,
  createdAt: new Date('2026-07-10T12:00:00.000Z'),
  updatedAt: new Date('2026-07-10T12:00:00.000Z'),
};

const registrations = [
  {
    id: 'registration-alex',
    eventId,
    hackerId: 'hacker-alex',
    status: 'APPROVED',
    cancelledAt: null,
    hacker: {
      id: 'hacker-alex',
      name: 'Alex Builder',
      email: 'alex@example.com',
      phone: '+15555550101',
    },
  },
  {
    id: 'registration-blair',
    eventId,
    hackerId: 'hacker-blair',
    status: 'APPROVED',
    cancelledAt: null,
    hacker: {
      id: 'hacker-blair',
      name: 'Blair Maker',
      email: 'blair@example.com',
      phone: '+15555550102',
    },
  },
];

const snapshotRows = [
  {
    id: 'recipient-alex',
    communicationId: blastId,
    hackerId: 'hacker-alex',
    registrationId: 'registration-alex',
    contactValue: 'alex@example.com',
    displayName: 'Alex Builder',
    status: 'SENT',
    providerMessageId: 'provider-alex',
    errorCode: null,
    errorMessage: null,
  },
  {
    id: 'recipient-blair',
    communicationId: blastId,
    hackerId: 'hacker-blair',
    registrationId: 'registration-blair',
    contactValue: 'blair@example.com',
    displayName: 'Blair Maker',
    status: 'FAILED',
    providerMessageId: null,
    errorCode: 'PROVIDER_REJECTED',
    errorMessage: 'Delivery was rejected.',
  },
];

function loadRoute<T>(path: string): T {
  try {
    return require(path) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected event-communication route ${path}: ${message}`);
  }
}

function mockOrganizer() {
  mockAuthenticatedClerk({ userId: 'clerk-mc' });
  prisma.hacker.findUnique.mockResolvedValue({
    id: 'hacker-mc',
    clerkId: 'clerk-mc',
    role: 'HACKER',
  });
  prisma.event.findUnique.mockResolvedValue({
    id: eventId,
    chapterId: 'chapter-boston',
    title: 'AI Build Night',
    slug: 'ai-build-night',
    status: 'PUBLISHED',
    startTime: new Date('2026-09-05T22:00:00.000Z'),
    timezone: 'America/New_York',
    venueName: 'Build Lab',
    staff: [{ role: 'MC' }],
  });
  prisma.chapter.findUnique.mockResolvedValue({
    name: 'Sundai Boston',
    slug: 'boston',
  });
  prisma.eventStaff.findFirst.mockResolvedValue({
    id: 'staff-mc',
    eventId,
    hackerId: 'hacker-mc',
    role: 'MC',
  });
  prisma.chapterMembership.findFirst.mockResolvedValue(null);
}

function mockEligibleAudience() {
  prisma.eventRegistration.findMany.mockResolvedValue(registrations);
  prisma.chapterMembership.findMany.mockResolvedValue(
    registrations.map(registration => ({
      hackerId: registration.hackerId,
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
      smsConsentVersion: '2026-07',
    }))
  );
  prisma.userBan.findMany.mockResolvedValue([]);
}

describe('/api/events/[eventId]/blasts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    mockOrganizer();
    mockEligibleAudience();
    prisma.$transaction.mockImplementation(async (operation: any) =>
      typeof operation === 'function'
        ? operation(prisma)
        : Promise.all(operation)
    );
    prisma.eventCommunication.groupBy.mockResolvedValue([]);
    prisma.eventCommunicationRecipient.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('returns the latest sent chapter invitation status', async () => {
    const sentAt = new Date('2026-09-04T18:50:00.000Z');
    prisma.eventCommunication.findMany.mockResolvedValue([]);
    prisma.eventCommunication.findFirst.mockResolvedValue({
      id: 'chapter-invitation-email',
      channel: 'EMAIL',
      status: 'SENT',
      recipientCount: 6,
      sentCount: 6,
      failedCount: 0,
      sentAt,
    });
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts`),
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      chapterInvitationStatus: {
        status: 'SENT',
        sentCount: 6,
        failedCount: 0,
        sentAt: sentAt.toISOString(),
      },
    });
    expect(prisma.eventCommunication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audienceType: 'CHAPTER_MEMBERS',
          status: { not: 'DRAFT' },
        }),
      })
    );
  });

  it('rejects edits to sent communication content and audience definitions', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'SENT',
      sentAt: new Date('2026-07-10T13:00:00.000Z'),
    });
    const { PATCH } = loadRoute<{ PATCH: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/route'
    );

    const response = await PATCH(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}`, {
        method: 'PATCH',
        body: { body: 'Mutated content', audienceType: 'DECLINED' },
      }),
      createRouteContext({ eventId, blastId })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringMatching(/sent|immutable/i),
      })
    );
    expect(prisma.eventCommunication.update).not.toHaveBeenCalled();
  });

  it('previews eligible counts, neutral exclusions, and a deterministic fingerprint', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue(draft);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/preview/route'
    );

    const first = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/preview`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );
    const second = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/preview`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(firstBody).toMatchObject({
      channel: 'EMAIL',
      eligibleCount: 2,
      exclusions: {
        cancelled: 0,
        missingContact: 0,
        preferenceDisabled: 0,
        ineligible: 0,
      },
      previewFingerprint: expect.stringMatching(/^sha256:/),
    });
    expect(firstBody.previewFingerprint).toBe(secondBody.previewFingerprint);
    expect(firstBody.exclusions).not.toHaveProperty('banned');
  });

  it('previews active chapter members without requiring event registrations', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      audienceType: 'CHAPTER_MEMBERS',
    });
    prisma.chapterMembership.findMany.mockResolvedValue([
      {
        status: 'ACTIVE',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        smsConsentAt: null,
        smsConsentVersion: null,
        hacker: {
          id: 'hacker-member',
          name: 'Chapter Member',
          email: 'member@example.com',
          phoneNumber: null,
        },
      },
    ]);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/preview/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/preview`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ eligibleCount: 1 });
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('provides formatted invitation defaults only for a published event', async () => {
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/invitation/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts/invitation`),
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      subject: "You're invited to AI Build Night",
      emailBody: expect.stringContaining('Build Lab'),
      smsBody: expect.stringContaining('AI Build Night'),
    });
  });

  it('previews the union of selected registration-status audiences', async () => {
    const pendingRegistration = {
      ...registrations[0],
      id: 'registration-pending',
      hackerId: 'hacker-pending',
      status: 'PENDING',
      hacker: {
        ...registrations[0].hacker,
        id: 'hacker-pending',
        email: 'pending@example.com',
      },
    };
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      audienceDefinitionJson: { statuses: ['PENDING', 'APPROVED'] },
    });
    prisma.eventRegistration.findMany.mockResolvedValue([
      ...registrations,
      pendingRegistration,
    ]);
    prisma.chapterMembership.findMany.mockResolvedValue([
      ...registrations.map(registration => ({
        hackerId: registration.hackerId,
        status: 'ACTIVE',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
        smsConsentVersion: '2026-07',
      })),
      {
        hackerId: pendingRegistration.hackerId,
        status: 'ACTIVE',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
        smsConsentVersion: '2026-07',
      },
    ]);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/preview/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/preview`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ eligibleCount: 3 });
  });

  it('returns 409 with a replacement preview and sends nothing when the audience changed', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue(draft);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/send/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/send`, {
        method: 'POST',
        body: { previewFingerprint: 'sha256:stale-preview' },
      }),
      createRouteContext({ eventId, blastId })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: expect.stringMatching(/audience.*changed|reconfirm/i),
      preview: {
        eligibleCount: 2,
        previewFingerprint: expect.stringMatching(/^sha256:/),
      },
    });
    expect(
      prisma.eventCommunicationRecipient.createMany
    ).not.toHaveBeenCalled();
    expect(prisma.eventCommunication.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENDING' }),
      })
    );
  });

  it('is idempotent after sending and does not create a second recipient snapshot', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'SENT',
      recipientCount: 2,
      sentCount: 2,
      sentAt: new Date('2026-07-10T13:00:00.000Z'),
    });
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/send/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/send`, {
        method: 'POST',
        body: { previewFingerprint: 'sha256:any-retry-value' },
      }),
      createRouteContext({ eventId, blastId })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: blastId,
      status: 'SENT',
      recipientCount: 2,
      sentCount: 2,
    });
    expect(
      prisma.eventCommunicationRecipient.createMany
    ).not.toHaveBeenCalled();
  });

  it('snapshots and queues an email blast without sending in the request', async () => {
    const {
      fingerprintEventCommunicationAudience,
      resolveCurrentEventCommunicationAudience,
    } = require('@/lib/eventCommunications');
    const audience = await resolveCurrentEventCommunicationAudience({
      eventId,
      chapterId: 'chapter-boston',
      audienceType: 'APPROVED',
      audienceDefinition: {},
      channel: 'EMAIL',
    });
    const previewFingerprint = fingerprintEventCommunicationAudience({
      channel: 'EMAIL',
      audienceType: 'APPROVED',
      recipients: audience.recipients,
    });
    prisma.eventCommunication.updateMany.mockResolvedValue({ count: 1 });
    prisma.eventCommunication.findUnique
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({
        id: blastId,
        recipients: [
          { id: 'recipient-alex', contactValue: 'alex@example.com' },
        ],
      })
      .mockResolvedValueOnce({
        ...draft,
        status: 'SENDING',
        recipientCount: 2,
      });
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/send/route'
    );
    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/send`, {
        method: 'POST',
        body: { previewFingerprint },
      }),
      createRouteContext({ eventId, blastId })
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: 'SENDING' });
    expect(require('@/lib/emailQueue').createEmailBatches).toHaveBeenCalledWith(
      prisma,
      [
        expect.objectContaining({
          to: 'alex@example.com',
          eventRecipientId: 'recipient-alex',
          subject: draft.subject,
        }),
      ],
      { eventCommunicationId: blastId }
    );
    expect(
      require('@/lib/emailQueue').publishEmailBatches
    ).toHaveBeenCalledWith(['batch-1']);
    expect(
      require('@/lib/eventDelivery').deliverEventSmsRecipients
    ).not.toHaveBeenCalled();
    expect(prisma.eventCommunicationRecipient.update).not.toHaveBeenCalled();
  });

  it('requeues only never-started batches after a queue publication failure', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'SENDING',
    });
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/send/route'
    );
    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/send`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );
    expect(response.status).toBe(202);
    expect(prisma.emailDeliveryBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventCommunicationId: blastId, status: 'QUEUED' },
      })
    );
    expect(
      prisma.eventCommunicationRecipient.createMany
    ).not.toHaveBeenCalled();
  });

  it('returns aggregate delivery results without recipient contact details', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'PARTIAL',
      recipientCount: 3,
      sentCount: 2,
      failedCount: 1,
    });
    prisma.eventCommunicationRecipient.groupBy.mockImplementation(
      ({ by }: { by: string[] }) => {
        if (by.includes('status'))
          return Promise.resolve([
            {
              communicationId: blastId,
              status: 'DELIVERED',
              _count: { _all: 2 },
            },
            {
              communicationId: blastId,
              status: 'UNDELIVERED',
              _count: { _all: 1 },
            },
          ]);
        if (by.includes('errorCode'))
          return Promise.resolve([
            {
              communicationId: blastId,
              errorCode: 'Bounce.Permanent.NoEmail',
              _max: { errorMessage: 'smtp; 550 alex@example.com unknown' },
              _count: { _all: 1 },
            },
          ]);
        return Promise.resolve([]);
      }
    );
    // Link rows, then per-message click totals.
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          sourceId: blastId,
          url: 'https://www.sundai.club/events/boston/build',
          kind: 'CONTENT',
          isEventLink: true,
          clicks: 3,
          uniqueClicks: 1,
          botClicks: 2,
          rsvps: 1,
        },
      ])
      .mockResolvedValueOnce([
        { sourceId: blastId, clicked: 1, preferenceClicks: 0, rsvps: 1 },
      ]);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}`),
      createRouteContext({ eventId, blastId })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'PARTIAL', recipientCount: 3 });
    expect(body.stats).toEqual({
      total: 3,
      pending: 0,
      accepted: 0,
      delivered: 2,
      failed: 1,
      complained: 0,
      unsubscribed: 0,
      clicked: 1,
      rsvps: 1,
      hasEventLinks: true,
      preferenceClicks: 0,
      botClicks: 2,
      failureReasons: [
        {
          code: 'Bounce.Permanent.NoEmail',
          label: 'Email address does not exist',
          hint: 'Ask the member to update their email address.',
          example: 'smtp; 550 [email] unknown',
          count: 1,
        },
      ],
      links: [
        {
          url: 'https://www.sundai.club/events/boston/build',
          kind: 'CONTENT',
          clicks: 3,
          uniqueClicks: 1,
          botClicks: 2,
          rsvps: 1,
        },
      ],
    });
    expect(body).not.toHaveProperty('recipients');
    expect(prisma.eventCommunicationRecipient.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain('@example.com');
  });

  it('lists sent history grouped by send with email before SMS', async () => {
    prisma.eventCommunication.groupBy.mockResolvedValue([
      { sendGroupId: 'group-1', _max: { createdAt: new Date() } },
    ]);
    const row = {
      ...draft,
      sendGroupId: 'group-1',
      status: 'SENT',
      sentAt: new Date('2026-07-10T12:05:00.000Z'),
      sentBy: { id: 'hacker-mc', name: 'Morgan MC' },
      createdBy: { id: 'hacker-mc', name: 'Morgan MC' },
    };
    prisma.eventCommunication.findMany.mockResolvedValue([
      { ...row, id: 'sms-1', channel: 'SMS', subject: null },
      { ...row, id: 'email-1' },
    ]);
    prisma.eventCommunication.findFirst.mockResolvedValue(null);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts`),
      createRouteContext({ eventId })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      sendGroupId: 'group-1',
      sender: { name: 'Morgan MC' },
    });
    expect(
      body.items[0].communications.map((item: { id: string }) => item.id)
    ).toEqual(['email-1', 'sms-1']);
    expect(prisma.eventCommunication.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['sendGroupId'],
        where: { eventId, status: { not: 'DRAFT' } },
      })
    );
  });

  it('rejects a send group that belongs to another event or channel', async () => {
    prisma.eventCommunication.findFirst.mockResolvedValue({ id: 'other' });
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/route'
    );

    const invalid = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts`, {
        method: 'POST',
        body: {
          channel: 'EMAIL',
          subject: 'Hi',
          body: 'Body',
          audienceType: 'APPROVED',
          sendGroupId: 'not-a-uuid',
        },
      }),
      createRouteContext({ eventId })
    );
    expect(invalid.status).toBe(400);

    const conflict = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts`, {
        method: 'POST',
        body: {
          channel: 'EMAIL',
          subject: 'Hi',
          body: 'Body',
          audienceType: 'APPROVED',
          sendGroupId: '7d9f1e8a-1b2c-4d3e-8f90-123456789abc',
        },
      }),
      createRouteContext({ eventId })
    );
    expect(conflict.status).toBe(409);
    expect(prisma.eventCommunication.create).not.toHaveBeenCalled();
  });

  it('redacts organizer notes and revisions from communication previews', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue(draft);
    prisma.eventRegistration.findMany.mockResolvedValue([
      {
        ...registrations[0],
        internalReviewNotes: 'PRIVATE COMMUNICATION REVIEW SENTINEL',
        hacker: {
          ...registrations[0].hacker,
          organizerNote: { body: 'PRIVATE COMMUNICATION NOTE SENTINEL' },
          organizerNoteRevisions: [
            { patchText: 'PRIVATE COMMUNICATION REVISION SENTINEL' },
          ],
        },
      },
    ]);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/preview/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}/preview`, {
        method: 'POST',
      }),
      createRouteContext({ eventId, blastId })
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('PRIVATE COMMUNICATION NOTE SENTINEL');
    expect(serialized).not.toContain('PRIVATE COMMUNICATION REVISION SENTINEL');
    expect(serialized).not.toContain('PRIVATE COMMUNICATION REVIEW SENTINEL');
    expect(serialized).not.toMatch(
      /organizerNote|noteRevisions|internalReview/i
    );
  });
});

describe('location-scoped event communications', () => {
  const config = {
    locations: [
      { id: 'boston', name: 'BU' },
      { id: 'lowell', name: 'Lowell' },
    ],
  };
  const definition = { locationIds: ['boston'] };
  const context = createRouteContext({ eventId, blastId });
  beforeEach(() => {
    jest.resetAllMocks();
    resetClerkMocks();
    mockOrganizer();
    mockEligibleAudience();
    prisma.event.findUnique.mockResolvedValue({
      id: eventId,
      chapterId: 'chapter-boston',
      status: 'PUBLISHED',
      staff: [{ role: 'MC' }],
      communicationLocationsJson: config,
    });
    prisma.eventRegistration.findMany.mockResolvedValue(
      registrations.map((row, index) => ({
        ...row,
        answersJson: { venue: index === 0 ? 'BU' : 'Lowell' },
      }))
    );
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      audienceDefinitionJson: definition,
    });
    prisma.$transaction.mockImplementation(async (operation: any) =>
      typeof operation === 'function'
        ? operation(prisma)
        : Promise.all(operation)
    );
  });

  it('previews only selected locations, combined with registration status', async () => {
    const {
      POST,
    } = require('@/app/api/events/[eventId]/blasts/[blastId]/preview/route');
    const response = await POST(createJsonRequest('/preview'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ eligibleCount: 1 });
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId } })
    );
  });

  it.each([[], ['foreign-event-location'], null])(
    'rejects invalid selections at draft creation and update: %j',
    async locationIds => {
      const { POST } = require('@/app/api/events/[eventId]/blasts/route');
      const {
        PATCH,
      } = require('@/app/api/events/[eventId]/blasts/[blastId]/route');
      const body = {
        channel: 'EMAIL',
        audienceType: 'APPROVED',
        subject: 'Venue update',
        body: 'Room changed',
        audienceDefinition: { locationIds },
      };
      expect(
        (await POST(createJsonRequest('/blasts', { body }), context)).status
      ).toBe(400);
      expect(
        (
          await PATCH(
            createJsonRequest('/blasts/draft', { method: 'PATCH', body }),
            context
          )
        ).status
      ).toBe(400);
      expect(prisma.eventCommunication.create).not.toHaveBeenCalled();
      expect(prisma.eventCommunication.update).not.toHaveBeenCalled();
    }
  );

  it('refuses to send after a location is removed', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: eventId,
      chapterId: 'chapter-boston',
      staff: [{ role: 'MC' }],
      communicationLocationsJson: { ...config, locations: [] },
    });
    const {
      POST,
    } = require('@/app/api/events/[eventId]/blasts/[blastId]/send/route');
    const response = await POST(
      createJsonRequest('/send', {
        body: { previewFingerprint: 'old-preview' },
      }),
      context
    );
    expect(response.status).toBe(409);
    expect(
      prisma.eventCommunicationRecipient.createMany
    ).not.toHaveBeenCalled();
  });

  it('requires a new confirmation when an applicant changes location after preview', async () => {
    const previewRoute = require('@/app/api/events/[eventId]/blasts/[blastId]/preview/route');
    const sendRoute = require('@/app/api/events/[eventId]/blasts/[blastId]/send/route');
    const preview = await (
      await previewRoute.POST(createJsonRequest('/preview'), context)
    ).json();
    prisma.eventRegistration.findMany.mockResolvedValue(
      registrations.map(row => ({ ...row, answersJson: { venue: 'Lowell' } }))
    );
    const response = await sendRoute.POST(
      createJsonRequest('/send', {
        body: { previewFingerprint: preview.previewFingerprint },
      }),
      context
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      preview: { eligibleCount: 0 },
    });
    expect(
      prisma.eventCommunicationRecipient.createMany
    ).not.toHaveBeenCalled();
  });

  it('snapshots and queues only recipients at the selected location', async () => {
    const previewRoute = require('@/app/api/events/[eventId]/blasts/[blastId]/preview/route');
    const preview = await (
      await previewRoute.POST(createJsonRequest('/preview'), context)
    ).json();
    prisma.eventCommunication.updateMany.mockResolvedValue({ count: 1 });
    prisma.eventCommunication.findUnique
      .mockResolvedValueOnce({ ...draft, audienceDefinitionJson: definition })
      .mockResolvedValueOnce({
        id: blastId,
        recipients: [
          { id: 'recipient-alex', contactValue: 'alex@example.com' },
        ],
      })
      .mockResolvedValueOnce({
        ...draft,
        status: 'SENDING',
        recipientCount: 1,
      });
    require('@/lib/emailQueue').createEmailBatches.mockResolvedValue([
      'batch-1',
    ]);
    prisma.emailDeliveryBatch.findMany.mockResolvedValue([{ id: 'batch-1' }]);
    const {
      POST,
    } = require('@/app/api/events/[eventId]/blasts/[blastId]/send/route');
    expect(
      (
        await POST(
          createJsonRequest('/send', {
            body: { previewFingerprint: preview.previewFingerprint },
          }),
          context
        )
      ).status
    ).toBe(202);
    expect(prisma.eventCommunicationRecipient.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ hackerId: 'hacker-alex' })],
    });
  });
});
