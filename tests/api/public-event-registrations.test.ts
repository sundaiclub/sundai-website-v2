import { GET as GET_EVENT } from '../../src/app/api/events/[eventId]/route';
import { POST as POST_REGISTRATION } from '../../src/app/api/events/[eventId]/registrations/route';
import { PATCH as PATCH_CURRENT_USER_REGISTRATION } from '../../src/app/api/events/[eventId]/registrations/me/route';
import { fetchMergedApplicationTemplate } from '../../src/lib/applicationTemplateQueries';
import { Prisma } from '@prisma/client';
import {
  createCurrentUserRegistrationCancelRequest,
  createCurrentUserRegistrationRequest,
  createCurrentUserRegistrationEditRequest,
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildEventRegistration,
  buildNativeEventRsvpFixture,
  type EventFixture,
  type EventRegistrationFixture,
  type EventRegistrationStatus,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/applicationTemplateQueries', () => ({
  fetchMergedApplicationTemplate: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventRegistrationAudit: {
      create: jest.fn(),
    },
    userBan: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

function getCurrentUserRegistrationCancelPostHandler() {
  return require('../../src/app/api/events/[eventId]/registrations/me/cancel/route')
    .POST as typeof POST_REGISTRATION;
}

const blockedRegistrationMessage =
  'You are unable to register for this event at this time.';

const submittedAt = new Date('2026-06-22T16:00:00.000Z');

const templateFields = [
  {
    id: 'name',
    label: 'Name',
    type: 'TEXT',
    required: true,
    siteRequired: true,
    order: 1,
  },
  {
    id: 'email',
    label: 'Email',
    type: 'EMAIL',
    required: true,
    siteRequired: true,
    order: 2,
  },
  {
    id: 'why_this_event',
    label: 'Why do you want to join this event?',
    type: 'TEXTAREA',
    required: true,
    order: 10,
  },
  {
    id: 'project_url',
    label: 'Project URL',
    type: 'URL',
    required: false,
    order: 20,
  },
];

const answersJson = {
  name: 'Signed In Applicant',
  email: 'applicant@example.com',
  why_this_event: 'I want to build with the Boston AI community.',
  project_url: 'https://example.com/applicant-project',
};

function mockHackerLookup(hacker: HackerFixture) {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    if (where?.clerkId === hacker.clerkId || where?.id === hacker.id) {
      return {
        id: hacker.id,
        clerkId: hacker.clerkId,
        role: hacker.role,
        name: hacker.name,
        email: hacker.email,
      };
    }

    return null;
  });
}

function mockPublicRegistrationDatabase({
  event,
  hacker,
  existingRegistration = null,
  bannedHackerIds = [],
  createdRegistration,
}: {
  event: EventFixture;
  hacker: HackerFixture;
  existingRegistration?: EventRegistrationFixture | null;
  bannedHackerIds?: string[];
  createdRegistration?: EventRegistrationFixture;
}) {
  mockHackerLookup(hacker);
  prisma.event.findUnique.mockResolvedValue(event);
  prisma.event.findFirst.mockImplementation(async ({ where }: any = {}) => {
    if (
      where?.id === event.id &&
      where?.status === 'PUBLISHED' &&
      where?.visibility === 'PUBLIC'
    ) {
      return {
        id: event.id,
        chapterId: event.chapterId,
        applicationMode: event.applicationMode,
        applicationsOpen: event.applicationsOpen,
      };
    }

    return null;
  });
  prisma.chapterMembership.findFirst.mockResolvedValue(null);
  prisma.eventStaff.findFirst.mockResolvedValue(null);
  prisma.eventRegistration.findFirst.mockResolvedValue(existingRegistration);
  prisma.eventRegistration.create.mockImplementation(async ({ data }: any) => ({
    ...(createdRegistration ??
      buildEventRegistration({
        id: 'registration-public-created',
        eventId: event.id,
        hackerId: hacker.id,
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      })),
    ...data,
    submittedAt,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  }));
  prisma.eventRegistration.update.mockImplementation(
    async ({ data }: any) => ({
      ...(existingRegistration ??
        buildEventRegistration({
          id: 'registration-public-updated',
          eventId: event.id,
          hackerId: hacker.id,
        })),
      ...data,
      updatedAt: submittedAt,
    })
  );
  prisma.eventRegistrationAudit.create.mockImplementation(
    async ({ data }: any) => ({
      id: 'registration-audit-public',
      ...data,
      createdAt: submittedAt,
    })
  );
  prisma.userBan.findMany.mockImplementation(async ({ where }: any = {}) => {
    const requestedIds = where?.hackerId?.in ?? [];
    return bannedHackerIds
      .filter(hackerId => requestedIds.includes(hackerId))
      .map(hackerId => ({ hackerId }));
  });
  prisma.$transaction.mockImplementation(async (callback: any) =>
    callback(prisma)
  );
  (fetchMergedApplicationTemplate as jest.Mock).mockResolvedValue({
    fields: templateFields,
  });
}

describe('POST /api/events/[eventId]/registrations public submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(submittedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires sign-in before submission', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockSignedOutClerk();

    const response = await POST_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(401);
    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });

  it('creates a signed-in public application with PENDING status, WEBSITE source, answers, and a template snapshot', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const createdRegistration = buildEventRegistration({
      id: 'registration-public-created',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status: 'PENDING',
      source: 'WEBSITE',
      answersJson,
      templateSnapshotJson: templateFields,
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.applicant,
      createdRegistration,
    });

    const response = await POST_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      id: createdRegistration.id,
      status: 'PENDING',
      submittedAt: submittedAt.toISOString(),
      publicSafeMessage: null,
    });
    expect(body).not.toHaveProperty('answersJson');
    expect(body).not.toHaveProperty('source');
    expect(body).not.toHaveProperty('templateSnapshotJson');
    expect(prisma.eventRegistration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: fixture.publishedEvent.id,
        hackerId: fixture.applicant.id,
        status: 'PENDING',
        source: 'WEBSITE',
        answersJson,
        templateSnapshotJson: templateFields,
        publicSafeMessage: null,
        internalReviewNotes: null,
        decidedById: null,
        decidedAt: null,
      }),
    });
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: createdRegistration.id,
        eventId: fixture.publishedEvent.id,
        actorId: fixture.applicant.id,
        fromStatus: null,
        toStatus: 'PENDING',
        changeJson: expect.objectContaining({
          action: 'SUBMIT_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
          applicationMode: 'REQUIRES_APPROVAL',
        }),
      }),
    });
  });

  it('rejects duplicate registrations with the current public status response', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const existingRegistration = buildEventRegistration({
      id: 'registration-existing-pending',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status: 'PENDING',
      publicSafeMessage: null,
      submittedAt,
      createdAt: submittedAt,
    });

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.applicant,
      existingRegistration,
    });

    const response = await POST_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      id: existingRegistration.id,
      status: 'PENDING',
      submittedAt: submittedAt.toISOString(),
      publicSafeMessage: null,
    });
    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });

  it('stores a blocked registration for banned users and returns only the generic public-safe response', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const blockedRegistration = buildEventRegistration({
      id: 'registration-public-blocked',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.bannedApplicant.id,
      status: 'BLOCKED',
      source: 'WEBSITE',
      answersJson: null,
      templateSnapshotJson: null,
      publicSafeMessage: blockedRegistrationMessage,
      internalReviewNotes: null,
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    mockAuthenticatedClerk({ userId: fixture.bannedApplicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.bannedApplicant,
      bannedHackerIds: [fixture.bannedApplicant.id],
      createdRegistration: blockedRegistration,
    });

    const response = await POST_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      id: blockedRegistration.id,
      status: 'BLOCKED',
      submittedAt: submittedAt.toISOString(),
      publicSafeMessage: blockedRegistrationMessage,
    });
    expect(JSON.stringify(body)).not.toContain('ban');
    expect(JSON.stringify(body)).not.toContain('Internal');
    expect(JSON.stringify(body)).not.toContain(fixture.ban.internalNote ?? '');
    expect(prisma.eventRegistration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: fixture.publishedEvent.id,
        hackerId: fixture.bannedApplicant.id,
        status: 'BLOCKED',
        source: 'WEBSITE',
        answersJson: Prisma.DbNull,
        templateSnapshotJson: Prisma.DbNull,
        publicSafeMessage: blockedRegistrationMessage,
        internalReviewNotes: null,
      }),
    });
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: blockedRegistration.id,
        eventId: fixture.publishedEvent.id,
        actorId: fixture.bannedApplicant.id,
        fromStatus: null,
        toStatus: 'BLOCKED',
        changeJson: {
          action: 'BLOCK_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
        },
      }),
    });
  });
});

describe('PATCH /api/events/[eventId]/registrations/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(submittedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates pending answers and template snapshot without changing submittedAt', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const originalSubmittedAt = new Date('2026-06-10T19:30:00.000Z');
    const existingRegistration = buildEventRegistration({
      id: 'registration-existing-pending',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status: 'PENDING',
      submittedAt: originalSubmittedAt,
      createdAt: originalSubmittedAt,
      updatedAt: new Date('2026-06-10T19:35:00.000Z'),
    });
    const updatedAnswersJson = {
      ...answersJson,
      why_this_event: 'I want to update my application with a stronger plan.',
      project_url: 'https://example.com/updated-project',
    };

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.applicant,
      existingRegistration,
    });

    const response = await PATCH_CURRENT_USER_REGISTRATION(
      createCurrentUserRegistrationEditRequest(fixture.publishedEvent.id, {
        answersJson: updatedAnswersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: existingRegistration.id,
      status: 'PENDING',
      submittedAt: originalSubmittedAt.toISOString(),
      publicSafeMessage: null,
    });
    expect(body).not.toHaveProperty('answersJson');
    expect(body).not.toHaveProperty('templateSnapshotJson');
    expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: existingRegistration.id },
      data: {
        answersJson: updatedAnswersJson,
        templateSnapshotJson: templateFields,
      },
    });
    expect(prisma.eventRegistration.update.mock.calls[0][0].data).not.toHaveProperty(
      'submittedAt'
    );
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: existingRegistration.id,
        eventId: fixture.publishedEvent.id,
        actorId: fixture.applicant.id,
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        changeJson: {
          action: 'EDIT_PUBLIC_REGISTRATION_ANSWERS',
          source: 'WEBSITE',
          submittedAtPreserved: true,
        },
      }),
    });
  });

  it.each<EventRegistrationStatus>([
    'APPROVED',
    'WAITLISTED',
    'DECLINED',
    'BLOCKED',
    'CANCELLED',
  ])('denies answer edits for %s registrations', async status => {
    const fixture = buildNativeEventRsvpFixture();
    const existingRegistration = buildEventRegistration({
      id: `registration-existing-${status.toLowerCase()}`,
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status,
      publicSafeMessage:
        status === 'BLOCKED' ? blockedRegistrationMessage : null,
      cancelledAt: status === 'CANCELLED' ? submittedAt : null,
      cancelledById:
        status === 'CANCELLED' ? fixture.applicant.id : null,
      waitlistedAt: status === 'WAITLISTED' ? submittedAt : null,
    });

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.applicant,
      existingRegistration,
    });

    const response = await PATCH_CURRENT_USER_REGISTRATION(
      createCurrentUserRegistrationEditRequest(fixture.publishedEvent.id, {
        answersJson: {
          ...answersJson,
          why_this_event: `Attempted edit for ${status.toLowerCase()}.`,
        },
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      id: existingRegistration.id,
      status,
      submittedAt: existingRegistration.submittedAt.toISOString(),
      publicSafeMessage:
        status === 'BLOCKED' ? blockedRegistrationMessage : null,
    });
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/events/[eventId]/registrations/me/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(submittedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires sign-in before cancellation', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const POST_CANCEL_REGISTRATION =
      getCurrentUserRegistrationCancelPostHandler();
    mockSignedOutClerk();

    const response = await POST_CANCEL_REGISTRATION(
      createCurrentUserRegistrationCancelRequest(
        fixture.publishedEvent.id
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(401);
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });

  it('cancels the current user registration with cancellation fields and a public audit entry', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const existingRegistration = buildEventRegistration({
      id: 'registration-current-user-waitlisted',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.waitlistedApplicant.id,
      status: 'WAITLISTED',
      publicSafeMessage: 'You are on the waitlist.',
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });
    const POST_CANCEL_REGISTRATION =
      getCurrentUserRegistrationCancelPostHandler();

    mockAuthenticatedClerk({ userId: fixture.waitlistedApplicant.clerkId });
    mockPublicRegistrationDatabase({
      event: fixture.publishedEvent,
      hacker: fixture.waitlistedApplicant,
      existingRegistration,
    });

    const response = await POST_CANCEL_REGISTRATION(
      createCurrentUserRegistrationCancelRequest(
        fixture.publishedEvent.id
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: existingRegistration.id,
      status: 'CANCELLED',
      submittedAt: submittedAt.toISOString(),
      publicSafeMessage: 'You are on the waitlist.',
    });
    expect(body).not.toHaveProperty('answersJson');
    expect(body).not.toHaveProperty('source');
    expect(body).not.toHaveProperty('templateSnapshotJson');
    expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: existingRegistration.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: submittedAt,
        cancelledById: fixture.waitlistedApplicant.id,
      },
    });
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: existingRegistration.id,
        eventId: fixture.publishedEvent.id,
        actorId: fixture.waitlistedApplicant.id,
        fromStatus: 'WAITLISTED',
        toStatus: 'CANCELLED',
        changeJson: {
          action: 'CANCEL_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
          cancelledBySelf: true,
        },
      },
    });
  });

  it('removes cancelled registrations from the active current-user state on public event detail responses', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const cancelledRegistration = buildEventRegistration({
      id: 'registration-current-user-cancelled',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status: 'CANCELLED',
      cancelledAt: submittedAt,
      cancelledById: fixture.applicant.id,
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockHackerLookup(fixture.applicant);
    prisma.event.findFirst.mockResolvedValue({
      ...fixture.publishedEvent,
      chapter: fixture.publicChapter,
      _count: { registrations: 0 },
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.eventRegistration.findFirst.mockImplementation(
      async ({ where }: any = {}) => {
        if (
          where?.eventId === fixture.publishedEvent.id &&
          where?.hackerId === fixture.applicant.id &&
          where?.cancelledAt === null
        ) {
          return null;
        }

        return cancelledRegistration;
      }
    );

    const response = await GET_EVENT(
      createJsonRequest(`/api/events/${fixture.publishedEvent.id}`) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: fixture.publishedEvent.id,
          hackerId: fixture.applicant.id,
          cancelledAt: null,
        }),
      })
    );
    expect(body.viewerRegistration).toBeNull();
    expect(body.viewerRegistrationStatus).toBeUndefined();
    expect(body.applicationControls).toEqual(
      expect.objectContaining({
        canEditAnswers: false,
        canCancelRegistration: false,
      })
    );
  });

  it('redacts organizer notes and revisions from attendee registration responses', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const registrationWithPrivateNotes = {
      ...buildEventRegistration({
        id: 'registration-private-note-sentinel',
        eventId: fixture.publishedEvent.id,
        hackerId: fixture.applicant.id,
        status: 'APPROVED',
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      }),
      organizerNote: { body: 'PRIVATE REGISTRATION NOTE SENTINEL' },
      organizerNoteRevisions: [
        { patchText: 'PRIVATE REGISTRATION REVISION SENTINEL' },
      ],
      internalReviewNotes: 'PRIVATE INTERNAL REVIEW SENTINEL',
    } as EventRegistrationFixture;

    mockAuthenticatedClerk({ userId: fixture.applicant.clerkId });
    mockHackerLookup(fixture.applicant);
    prisma.event.findFirst.mockResolvedValue({
      ...fixture.publishedEvent,
      chapter: fixture.publicChapter,
      _count: { registrations: 1 },
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.eventRegistration.findFirst.mockResolvedValue(
      registrationWithPrivateNotes
    );

    const response = await GET_EVENT(
      createJsonRequest(`/api/events/${fixture.publishedEvent.id}`) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('PRIVATE REGISTRATION NOTE SENTINEL');
    expect(serialized).not.toContain('PRIVATE REGISTRATION REVISION SENTINEL');
    expect(serialized).not.toContain('PRIVATE INTERNAL REVIEW SENTINEL');
    expect(serialized).not.toMatch(/organizerNote|noteRevisions/i);
  });
});
