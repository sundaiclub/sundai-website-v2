import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  resetClerkMocks,
} from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    chapterMembership: { findFirst: jest.fn(), findMany: jest.fn() },
    eventRegistration: { findMany: jest.fn() },
    userBan: { findMany: jest.fn() },
    eventCommunication: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    eventCommunicationRecipient: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
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
    staff: [{ role: 'MC' }],
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

  it('returns immutable recipient snapshots rather than recalculating changed registrations', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'PARTIAL',
      recipientCount: 2,
      sentCount: 1,
      failedCount: 1,
    });
    prisma.eventCommunicationRecipient.findMany.mockResolvedValue(snapshotRows);
    prisma.eventRegistration.findMany.mockResolvedValue([]);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}`),
      createRouteContext({ eventId, blastId })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hackerId: 'hacker-alex',
          contactValue: 'alex@example.com',
        }),
        expect.objectContaining({
          hackerId: 'hacker-blair',
          contactValue: 'blair@example.com',
        }),
      ])
    );
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('preserves successful outcomes and reports PARTIAL when one recipient fails', async () => {
    prisma.eventCommunication.findUnique.mockResolvedValue({
      ...draft,
      status: 'PARTIAL',
      recipientCount: 2,
      sentCount: 1,
      failedCount: 1,
    });
    prisma.eventCommunicationRecipient.findMany.mockResolvedValue(snapshotRows);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/blasts/[blastId]/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/blasts/${blastId}`),
      createRouteContext({ eventId, blastId })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      status: 'PARTIAL',
      recipientCount: 2,
      sentCount: 1,
      failedCount: 1,
    });
    expect(body.recipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hackerId: 'hacker-alex',
          status: 'SENT',
          providerMessageId: 'provider-alex',
        }),
        expect.objectContaining({
          hackerId: 'hacker-blair',
          status: 'FAILED',
          errorMessage: 'Delivery was rejected.',
        }),
      ])
    );
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
