import { POST as POST_EVENTS } from '../../src/app/api/events/route';
import { POST as POST_CURRENT_USER_CANCEL } from '../../src/app/api/events/[eventId]/registrations/me/cancel/route';
import {
  GET as GET_REGISTRATIONS,
  POST as POST_PUBLIC_REGISTRATION,
} from '../../src/app/api/events/[eventId]/registrations/route';
import {
  createCurrentUserRegistrationRequest,
  createCurrentUserRegistrationCancelRequest,
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapterAdminFixture,
  buildEventRegistration,
  buildNativeEventRsvpFixture,
  buildSiteAdmin,
  type ChapterMembershipFixture,
  type EventFixture,
  type EventRegistrationFixture,
  type EventStaffFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

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
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
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

const now = new Date('2026-06-23T14:00:00.000Z');

function mockHackerLookup(...hackers: HackerFixture[]) {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        hacker => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
}

function mockChapterMembershipLookup(
  membership?: ChapterMembershipFixture | null
) {
  prisma.chapterMembership.findFirst.mockImplementation(
    async ({ where }: any) => {
      if (
        membership &&
        where?.chapterId === membership.chapterId &&
        where?.hackerId === membership.hackerId
      ) {
        return membership;
      }

      return null;
    }
  );
}

function mockCurrentUserCancellationDatabase({
  actor,
  event,
  existingRegistration,
  approvedCountAfterCancellation,
  waitlistedRegistrations = [],
}: {
  actor: HackerFixture;
  event: EventFixture;
  existingRegistration: EventRegistrationFixture;
  approvedCountAfterCancellation?: number;
  waitlistedRegistrations?: EventRegistrationFixture[];
}) {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockHackerLookup(actor);
  prisma.event.findUnique.mockResolvedValue({
    id: event.id,
    capacity: event.capacity,
    autoPromoteWaitlist: event.autoPromoteWaitlist,
  });
  prisma.eventRegistration.findFirst.mockResolvedValue(existingRegistration);
  prisma.eventRegistration.count.mockResolvedValue(
    approvedCountAfterCancellation ?? 0
  );
  prisma.eventRegistration.findMany.mockResolvedValue(waitlistedRegistrations);
  prisma.eventRegistration.update.mockImplementation(
    async ({ where, data }: any) => {
      if (data.status === 'CANCELLED') {
        return {
          ...existingRegistration,
          ...data,
          updatedAt: now,
        };
      }

      const waitlistedRegistration = waitlistedRegistrations.find(
        registration => registration.id === where?.id
      );

      return {
        ...(waitlistedRegistration ?? waitlistedRegistrations[0]),
        ...data,
        updatedAt: now,
      };
    }
  );
  prisma.eventRegistrationAudit.create.mockImplementation(
    async ({ data }: any) => ({
      id: `registration-audit-${prisma.eventRegistrationAudit.create.mock.calls.length}`,
      ...data,
      createdAt: now,
    })
  );
  prisma.$transaction.mockImplementation(async (callback: any) =>
    callback(prisma)
  );
}

type ApplicationControlRoute = {
  POST: (
    req: Request,
    context: { params: { eventId: string } }
  ) => Promise<Response>;
};

type ApplicationControlActor = {
  label: string;
  actor: HackerFixture;
  membership?: ChapterMembershipFixture;
  staff?: EventStaffFixture;
};

const applicationControlNow = new Date('2026-06-23T15:30:00.000Z');

const applicationAnswersJson = {
  name: 'Signed In Applicant',
  email: 'applicant@example.com',
  why_this_event: 'I want to build with the Boston AI community.',
  project_url: 'https://example.com/applicant-project',
};

function loadApplicationCloseRoute(): ApplicationControlRoute {
  try {
    const route = require('../../src/app/api/events/[eventId]/applications/close/route');
    if (typeof route.POST !== 'function') {
      throw new Error('route must export a POST handler');
    }
    return route;
  } catch (error) {
    throw new Error(
      `Expected POST /api/events/[eventId]/applications/close route for T073. ${String(
        error
      )}`
    );
  }
}

function loadApplicationOpenRoute(): ApplicationControlRoute {
  try {
    const route = require('../../src/app/api/events/[eventId]/applications/open/route');
    if (typeof route.POST !== 'function') {
      throw new Error('route must export a POST handler');
    }
    return route;
  } catch (error) {
    throw new Error(
      `Expected POST /api/events/[eventId]/applications/open route for T074. ${String(
        error
      )}`
    );
  }
}

function mockEventStaffLookup(staff?: EventStaffFixture | null) {
  prisma.eventStaff.findFirst.mockImplementation(async ({ where }: any) => {
    if (
      staff &&
      where?.eventId === staff.eventId &&
      where?.hackerId === staff.hackerId
    ) {
      return staff;
    }

    return null;
  });
}

function mockApplicationControlDatabase({
  actor,
  event,
  membership = null,
  staff = null,
  extraHackers = [],
}: {
  actor: HackerFixture;
  event: EventFixture;
  membership?: ChapterMembershipFixture | null;
  staff?: EventStaffFixture | null;
  extraHackers?: HackerFixture[];
}) {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockHackerLookup(actor, ...extraHackers);
  mockChapterMembershipLookup(membership);
  mockEventStaffLookup(staff);
  prisma.event.findUnique.mockImplementation(async ({ where }: any) => {
    if (where?.id === event.id) {
      return event;
    }

    return null;
  });
  prisma.event.findFirst.mockImplementation(async ({ where }: any) => {
    if (where?.id === event.id) {
      return event;
    }

    return null;
  });
  prisma.event.update.mockImplementation(async ({ data }: any) => ({
    ...event,
    ...data,
    updatedAt: applicationControlNow,
  }));
  prisma.eventRegistration.findFirst.mockResolvedValue(null);
  prisma.eventRegistration.findMany.mockResolvedValue([]);
  prisma.eventRegistration.create.mockResolvedValue(null);
  prisma.eventRegistration.update.mockResolvedValue(null);
  prisma.eventRegistrationAudit.create.mockResolvedValue({
    id: 'application-control-audit',
    createdAt: applicationControlNow,
  });
  prisma.userBan.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation(async (callback: any) =>
    callback(prisma)
  );
}

function mockRegistrationReviewAfterCloseDatabase({
  actor,
  event,
  registration,
  membership = null,
  staff = null,
}: {
  actor: HackerFixture;
  event: EventFixture;
  registration: EventRegistrationFixture;
  membership?: ChapterMembershipFixture | null;
  staff?: EventStaffFixture | null;
}) {
  mockApplicationControlDatabase({
    actor,
    event,
    membership,
    staff,
  });
  prisma.eventRegistration.findMany.mockImplementation(
    async ({ where }: any = {}) => {
      if (where?.eventId === event.id) {
        return [registration];
      }

      return [];
    }
  );
}

function buildAllowedApplicationControlActors(): ApplicationControlActor[] {
  const fixture = buildNativeEventRsvpFixture();
  const chapterAdmin = buildChapterAdminFixture({
    chapter: fixture.publicChapter,
    membership: {
      chapterId: fixture.publicChapter.id,
    },
  });
  const siteAdmin = buildSiteAdmin();

  return [
    {
      label: 'chapter admin',
      actor: chapterAdmin.hacker,
      membership: chapterAdmin.membership,
    },
    {
      label: 'site admin',
      actor: siteAdmin,
    },
  ];
}

describe('T069 event application close/open controls API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(applicationControlNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires authentication before closing applications', async () => {
    const { POST } = loadApplicationCloseRoute();
    const fixture = buildNativeEventRsvpFixture();
    mockSignedOutClerk();

    const response = await POST(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/applications/close`,
        {
          method: 'POST',
          body: { reason: 'Capacity reached for this format.' },
        }
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(401);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it.each(buildAllowedApplicationControlActors())(
    'allows $label to close applications with closed metadata',
    async ({ actor, membership, staff }) => {
      const { POST } = loadApplicationCloseRoute();
      const fixture = buildNativeEventRsvpFixture();
      const reason = 'Capacity reached for this format.';
      mockApplicationControlDatabase({
        actor,
        event: fixture.publishedEvent,
        membership,
        staff,
      });

      const response = await POST(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/applications/close`,
          {
            method: 'POST',
            body: { reason },
          }
        ) as any,
        createRouteContext({ eventId: fixture.publishedEvent.id })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: fixture.publishedEvent.id },
          data: expect.objectContaining({
            applicationsOpen: false,
            applicationsClosedAt: applicationControlNow,
            applicationsClosedById: actor.id,
            applicationsCloseReason: reason,
          }),
        })
      );
      expect(body).toEqual(
        expect.objectContaining({
          id: fixture.publishedEvent.id,
          applicationsOpen: false,
          applicationsClosedAt: applicationControlNow.toISOString(),
          applicationsClosedById: actor.id,
          applicationsCloseReason: reason,
        })
      );
    }
  );

  it('rejects malformed close request JSON', async () => {
    const { POST } = loadApplicationCloseRoute();
    const fixture = buildNativeEventRsvpFixture();
    mockApplicationControlDatabase({
      actor: buildSiteAdmin(),
      event: fixture.publishedEvent,
    });

    const response = await POST(
      {
        json: jest
          .fn()
          .mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      } as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'Request body must be valid JSON' });
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('rejects non-string close reasons', async () => {
    const { POST } = loadApplicationCloseRoute();
    const fixture = buildNativeEventRsvpFixture();
    mockApplicationControlDatabase({
      actor: buildSiteAdmin(),
      event: fixture.publishedEvent,
    });

    const response = await POST(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/applications/close`,
        {
          method: 'POST',
          body: { reason: false },
        }
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'reason must be a string' });
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'MC',
      (fixture: ReturnType<typeof buildNativeEventRsvpFixture>) => fixture.mc,
    ],
    [
      'co-MC',
      (fixture: ReturnType<typeof buildNativeEventRsvpFixture>) => fixture.coMc,
    ],
  ])(
    'denies %s staff from closing applications',
    async (_label, staffFixture) => {
      const { POST } = loadApplicationCloseRoute();
      const fixture = buildNativeEventRsvpFixture();
      const assigned = staffFixture(fixture);
      mockApplicationControlDatabase({
        actor: assigned.hacker,
        event: fixture.publishedEvent,
        staff: assigned.staff,
      });

      const response = await POST(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/applications/close`,
          {
            method: 'POST',
            body: { reason: 'Organizer-only pause.' },
          }
        ) as any,
        createRouteContext({ eventId: fixture.publishedEvent.id })
      );

      expect(response.status).toBe(403);
      expect(prisma.event.update).not.toHaveBeenCalled();
    }
  );

  it.each(buildAllowedApplicationControlActors())(
    'allows $label to reopen applications and clear closed metadata',
    async ({ actor, membership, staff }) => {
      const { POST } = loadApplicationOpenRoute();
      const fixture = buildNativeEventRsvpFixture();
      const closedEvent = {
        ...fixture.publishedEvent,
        applicationsOpen: false,
        applicationsClosedAt: applicationControlNow,
        applicationsClosedById: fixture.mc.hacker.id,
        applicationsCloseReason: 'Capacity reached for this format.',
      };
      mockApplicationControlDatabase({
        actor,
        event: closedEvent,
        membership,
        staff,
      });

      const response = await POST(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/applications/open`,
          { method: 'POST', body: {} }
        ) as any,
        createRouteContext({ eventId: fixture.publishedEvent.id })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: fixture.publishedEvent.id },
          data: expect.objectContaining({
            applicationsOpen: true,
            applicationsClosedAt: null,
            applicationsClosedById: null,
            applicationsCloseReason: null,
          }),
        })
      );
      expect(body).toEqual(
        expect.objectContaining({
          id: fixture.publishedEvent.id,
          applicationsOpen: true,
          applicationsClosedAt: null,
          applicationsClosedById: null,
          applicationsCloseReason: null,
        })
      );
    }
  );

  it.each([
    [
      'MC',
      (fixture: ReturnType<typeof buildNativeEventRsvpFixture>) => fixture.mc,
    ],
    [
      'co-MC',
      (fixture: ReturnType<typeof buildNativeEventRsvpFixture>) => fixture.coMc,
    ],
  ])(
    'denies %s staff from reopening applications',
    async (_label, staffFixture) => {
      const { POST } = loadApplicationOpenRoute();
      const fixture = buildNativeEventRsvpFixture();
      const assigned = staffFixture(fixture);
      const closedEvent = {
        ...fixture.publishedEvent,
        applicationsOpen: false,
        applicationsClosedAt: applicationControlNow,
        applicationsClosedById: fixture.mc.hacker.id,
        applicationsCloseReason: 'Capacity reached for this format.',
      };
      mockApplicationControlDatabase({
        actor: assigned.hacker,
        event: closedEvent,
        staff: assigned.staff,
      });

      const response = await POST(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/applications/open`,
          { method: 'POST', body: {} }
        ) as any,
        createRouteContext({ eventId: fixture.publishedEvent.id })
      );

      expect(response.status).toBe(403);
      expect(prisma.event.update).not.toHaveBeenCalled();
    }
  );

  it('returns a public-safe response when closed applications block a new submission', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const closedEvent = {
      ...fixture.publishedEvent,
      applicationsOpen: false,
      applicationsClosedAt: applicationControlNow,
      applicationsClosedById: fixture.mc.hacker.id,
      applicationsCloseReason: 'Private organizer capacity planning notes.',
    };
    mockApplicationControlDatabase({
      actor: fixture.applicant,
      event: closedEvent,
    });

    const response = await POST_PUBLIC_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson: applicationAnswersJson,
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      message: 'Applications are closed for this event.',
    });
    expect(JSON.stringify(body)).not.toContain('Private organizer');
    expect(JSON.stringify(body)).not.toContain(fixture.mc.hacker.id);
    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });

  it('keeps existing registrations reviewable after applications close', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const closedEvent = {
      ...fixture.publishedEvent,
      applicationsOpen: false,
      applicationsClosedAt: applicationControlNow,
      applicationsClosedById: fixture.mc.hacker.id,
      applicationsCloseReason: 'Capacity reached for this format.',
    };
    mockRegistrationReviewAfterCloseDatabase({
      actor: fixture.mc.hacker,
      event: closedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });

    const response = await GET_REGISTRATIONS(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations`,
        {
          searchParams: { status: 'PENDING' },
        }
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId: fixture.publishedEvent.id,
        status: 'PENDING',
      },
      include: expect.objectContaining({ hacker: expect.any(Object) }),
      orderBy: { createdAt: 'desc' },
      take: 100,
      skip: 0,
    });
    expect(body).toEqual(
      expect.objectContaining({
        statusFilter: 'PENDING',
        rows: [
          expect.objectContaining({
            id: fixture.pendingRegistration.id,
            status: 'PENDING',
          }),
        ],
      })
    );
  });
});

describe('T070 waitlist auto-promotion API controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults waitlist auto-promotion off when organizers omit the setting', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const eventBody = {
      title: 'Boston Capacity Night',
      chapterId: chapter.id,
      slug: 'boston-capacity-night',
      startTime: '2026-07-10T22:00:00.000Z',
      capacity: 24,
    };
    const createdEvent = {
      id: 'event-boston-capacity-night',
      ...eventBody,
      applicationMode: 'REQUIRES_APPROVAL',
      applicationsOpen: true,
      autoPromoteWaitlist: false,
      createdById: hacker.id,
    };

    mockAuthenticatedClerk({ userId: hacker.clerkId });
    mockHackerLookup(hacker);
    mockChapterMembershipLookup(membership);
    prisma.event.create.mockResolvedValue(createdEvent);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: eventBody,
      }) as any
    );

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationMode: 'REQUIRES_APPROVAL',
          applicationsOpen: true,
          autoPromoteWaitlist: false,
        }),
      })
    );
  });

  it('does not promote a waitlisted registration when auto-promotion is disabled', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const event = {
      ...fixture.publishedEvent,
      capacity: 2,
      autoPromoteWaitlist: false,
    };

    mockCurrentUserCancellationDatabase({
      actor: fixture.approvedApplicant,
      event,
      existingRegistration: fixture.approvedRegistration,
      waitlistedRegistrations: [fixture.waitlistedRegistration],
    });

    const response = await POST_CURRENT_USER_CANCEL(
      createCurrentUserRegistrationCancelRequest(event.id) as any,
      createRouteContext({ eventId: event.id })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.count).not.toHaveBeenCalled();
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
    expect(prisma.eventRegistration.update).toHaveBeenCalledTimes(1);
    expect(prisma.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: fixture.approvedRegistration.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledById: fixture.approvedApplicant.id,
      },
    });
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledTimes(1);
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: fixture.approvedRegistration.id,
        fromStatus: 'APPROVED',
        toStatus: 'CANCELLED',
        changeJson: expect.objectContaining({
          action: 'CANCEL_PUBLIC_REGISTRATION',
        }),
      }),
    });
  });

  it('promotes the oldest eligible waitlisted registration when enabled and capacity allows', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const event = {
      ...fixture.publishedEvent,
      capacity: 2,
      autoPromoteWaitlist: true,
    };
    const newerWaitlisted = buildEventRegistration({
      id: 'registration-waitlisted-newer',
      eventId: event.id,
      hackerId: 'hacker-waitlisted-newer',
      status: 'WAITLISTED',
      publicSafeMessage: 'You are on the waitlist.',
      waitlistedAt: new Date('2026-06-23T13:00:00.000Z'),
      submittedAt: new Date('2026-06-23T12:55:00.000Z'),
      createdAt: new Date('2026-06-23T12:55:00.000Z'),
    });
    const oldestWaitlisted = buildEventRegistration({
      id: 'registration-waitlisted-oldest',
      eventId: event.id,
      hackerId: 'hacker-waitlisted-oldest',
      status: 'WAITLISTED',
      publicSafeMessage: 'You are on the waitlist.',
      waitlistedAt: new Date('2026-06-22T13:00:00.000Z'),
      submittedAt: new Date('2026-06-22T12:55:00.000Z'),
      createdAt: new Date('2026-06-22T12:55:00.000Z'),
    });

    mockCurrentUserCancellationDatabase({
      actor: fixture.approvedApplicant,
      event,
      existingRegistration: fixture.approvedRegistration,
      approvedCountAfterCancellation: 1,
      waitlistedRegistrations: [newerWaitlisted, oldestWaitlisted],
    });

    const response = await POST_CURRENT_USER_CANCEL(
      createCurrentUserRegistrationCancelRequest(event.id) as any,
      createRouteContext({ eventId: event.id })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId: event.id,
        status: 'WAITLISTED',
        cancelledAt: null,
      },
      orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prisma.eventRegistration.update).toHaveBeenNthCalledWith(2, {
      where: { id: oldestWaitlisted.id },
      data: {
        status: 'APPROVED',
        decidedById: fixture.approvedApplicant.id,
        decidedAt: now,
        publicSafeMessage: null,
      },
    });
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledTimes(2);
    expect(prisma.eventRegistrationAudit.create).toHaveBeenNthCalledWith(2, {
      data: {
        registrationId: oldestWaitlisted.id,
        eventId: event.id,
        actorId: fixture.approvedApplicant.id,
        fromStatus: 'WAITLISTED',
        toStatus: 'APPROVED',
        changeJson: {
          action: 'AUTO_PROMOTE_WAITLISTED_REGISTRATION',
          automatic: true,
          triggeringRegistrationId: fixture.approvedRegistration.id,
          approvedCountBeforePromotion: 1,
          capacity: 2,
        },
      },
    });
  });

  it('does not promote when approved capacity is still full after cancellation', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const event = {
      ...fixture.publishedEvent,
      capacity: 1,
      autoPromoteWaitlist: true,
    };

    mockCurrentUserCancellationDatabase({
      actor: fixture.approvedApplicant,
      event,
      existingRegistration: fixture.approvedRegistration,
      approvedCountAfterCancellation: 1,
      waitlistedRegistrations: [fixture.waitlistedRegistration],
    });

    const response = await POST_CURRENT_USER_CANCEL(
      createCurrentUserRegistrationCancelRequest(event.id) as any,
      createRouteContext({ eventId: event.id })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.count).toHaveBeenCalledWith({
      where: {
        eventId: event.id,
        status: 'APPROVED',
        cancelledAt: null,
      },
    });
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
    expect(prisma.eventRegistration.update).toHaveBeenCalledTimes(1);
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledTimes(1);
    expect(prisma.eventRegistrationAudit.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeJson: expect.objectContaining({
            action: 'AUTO_PROMOTE_WAITLISTED_REGISTRATION',
          }),
        }),
      })
    );
  });
});
