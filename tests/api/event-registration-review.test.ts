import {
  GET as GET_REGISTRATIONS,
  POST as POST_PUBLIC_REGISTRATION,
} from '../../src/app/api/events/[eventId]/registrations/route';
import { PATCH as PATCH_REGISTRATION } from '../../src/app/api/events/[eventId]/registrations/[registrationId]/route';
import {
  createCurrentUserRegistrationRequest,
  createJsonRequest,
  createRouteContext,
  createSiteAdminIncludeBannedRegistrationsRequest,
  mockAuthenticatedClerk,
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
import type { RegistrationStatus } from '../../src/types/event-management';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/eventDecisionNotifications', () => ({
  notifyEventDecision: jest.fn().mockResolvedValue({
    email: 'sent',
    sms: 'sent',
  }),
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
      findMany: jest.fn(),
      count: jest.fn(),
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
const {
  notifyEventDecision,
} = require('../../src/lib/eventDecisionNotifications');

type RegistrationNotesRoute = {
  POST: (
    req: Request,
    context: { params: { eventId: string; registrationId: string } }
  ) => Promise<Response>;
};

type ReviewActor = {
  label: string;
  actor: HackerFixture;
  membership?: ChapterMembershipFixture;
  staff?: EventStaffFixture;
};

const submittedAt = new Date('2026-06-22T16:00:00.000Z');

const loadRegistrationNotesRoute = (): RegistrationNotesRoute => {
  try {
    const route = require('../../src/app/api/events/[eventId]/registrations/[registrationId]/notes/route');
    if (typeof route.POST !== 'function') {
      throw new Error('route must export a POST handler');
    }
    return route;
  } catch (error) {
    throw new Error(
      `Expected POST /api/events/[eventId]/registrations/[registrationId]/notes route for T053/T057. ${String(
        error
      )}`
    );
  }
};

const mockHackerLookup = (...hackers: HackerFixture[]) => {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        hacker => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
};

const mockReviewPermissionDatabase = ({
  actor,
  event,
  registration,
  membership = null,
  staff = null,
  extraHackers = [],
}: {
  actor: HackerFixture;
  event: EventFixture;
  registration: EventRegistrationFixture;
  membership?: ChapterMembershipFixture | null;
  staff?: EventStaffFixture | null;
  extraHackers?: HackerFixture[];
}) => {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockHackerLookup(actor, ...extraHackers);
  prisma.event.findUnique.mockImplementation(async ({ where }: any) => {
    return where?.id === event.id ? event : null;
  });
  prisma.event.findFirst.mockImplementation(async ({ where }: any) => {
    return where?.id === event.id ? event : null;
  });
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
  prisma.eventRegistration.findFirst.mockImplementation(
    async ({ where }: any) => {
      if (where?.id === registration.id && where?.eventId === event.id) {
        return registration;
      }

      if (
        where?.eventId === event.id &&
        where?.hackerId === registration.hackerId
      ) {
        return registration;
      }

      return null;
    }
  );
  prisma.eventRegistration.update.mockImplementation(async ({ data }: any) => ({
    ...registration,
    ...data,
    updatedAt: submittedAt,
  }));
  prisma.eventRegistrationAudit.create.mockImplementation(
    async ({ data }: any) => ({
      id: 'registration-audit-internal-note',
      ...data,
      createdAt: submittedAt,
    })
  );
  prisma.userBan.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation(async (callback: any) =>
    callback(prisma)
  );
};

const buildReviewActors = (): ReviewActor[] => {
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
      label: 'MC',
      actor: fixture.mc.hacker,
      staff: fixture.mc.staff,
    },
    {
      label: 'co-MC',
      actor: fixture.coMc.hacker,
      staff: fixture.coMc.staff,
    },
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
};

function mockRegistrationList(
  registrations: EventRegistrationFixture[],
  bannedHackerIds: string[] = []
) {
  prisma.eventRegistration.findMany.mockImplementation(
    async ({ where }: any = {}) =>
      registrations.filter(registration => {
        if (where?.eventId && registration.eventId !== where.eventId) {
          return false;
        }
        if (where?.status && registration.status !== where.status) {
          return false;
        }
        return true;
      })
  );
  prisma.eventRegistration.count.mockImplementation(
    async ({ where }: any = {}) =>
      registrations.filter(registration => {
        if (where?.eventId && registration.eventId !== where.eventId) {
          return false;
        }
        if (where?.status && registration.status !== where.status) {
          return false;
        }
        if (
          where?.hacker?.userBans?.none &&
          bannedHackerIds.includes(registration.hackerId)
        ) {
          return false;
        }
        return true;
      }).length
  );
  prisma.userBan.findMany.mockImplementation(async ({ where }: any = {}) => {
    const requestedIds = where?.hackerId?.in ?? [];
    return bannedHackerIds
      .filter(hackerId => requestedIds.includes(hackerId))
      .map(hackerId => ({ hackerId }));
  });
}

describe('T051 organizer registration review listing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('filters registration review rows by requested status', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList([
      fixture.pendingRegistration,
      fixture.approvedRegistration,
      fixture.waitlistedRegistration,
    ]);

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
        counts: expect.objectContaining({
          PENDING: 1,
          APPROVED: 1,
          WAITLISTED: 1,
        }),
        rows: [
          expect.objectContaining({
            id: fixture.pendingRegistration.id,
            status: 'PENDING',
            applicant: expect.objectContaining({
              id: fixture.applicant.id,
              name: fixture.applicant.name,
              email: fixture.applicant.email,
            }),
            capabilities: expect.objectContaining({
              canDecide: true,
              canApprove: true,
              canDecline: true,
            }),
          }),
        ],
      })
    );
  });

  it('hides actively banned applicants from non-site-admin registration review', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList(
      [fixture.blockedRegistration, fixture.pendingRegistration],
      [fixture.bannedApplicant.id]
    );

    const response = await GET_REGISTRATIONS(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations`
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toEqual(
      expect.objectContaining({
        id: fixture.pendingRegistration.id,
        hackerId: fixture.applicant.id,
      })
    );
    expect(JSON.stringify(body.rows)).not.toContain(fixture.bannedApplicant.id);
    expect(JSON.stringify(body.rows)).not.toContain(
      fixture.ban.internalNote ?? ''
    );
  });

  it('allows site admins to include banned users in registration review', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const siteAdmin = buildSiteAdmin();
    mockReviewPermissionDatabase({
      actor: siteAdmin,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
    });
    mockRegistrationList(
      [fixture.blockedRegistration, fixture.pendingRegistration],
      [fixture.bannedApplicant.id]
    );

    const response = await GET_REGISTRATIONS(
      createSiteAdminIncludeBannedRegistrationsRequest(
        fixture.publishedEvent.id
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.userBan.findMany).not.toHaveBeenCalled();
    expect(body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.blockedRegistration.id,
          hackerId: fixture.bannedApplicant.id,
        }),
        expect.objectContaining({
          id: fixture.pendingRegistration.id,
          hackerId: fixture.applicant.id,
        }),
      ])
    );
  });
});

describe('T052 organizer registration review decisions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(submittedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each<RegistrationStatus>(['APPROVED', 'WAITLISTED', 'DECLINED'])(
    'allows MCs to update applicant status to %s with audit entries',
    async status => {
      const fixture = buildNativeEventRsvpFixture();
      mockReviewPermissionDatabase({
        actor: fixture.mc.hacker,
        event: fixture.publishedEvent,
        registration: fixture.pendingRegistration,
        staff: fixture.mc.staff,
      });

      const response = await PATCH_REGISTRATION(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/registrations/${fixture.pendingRegistration.id}`,
          {
            method: 'PATCH',
            body: { status },
          }
        ) as any,
        createRouteContext({
          eventId: fixture.publishedEvent.id,
          registrationId: fixture.pendingRegistration.id,
        })
      );

      expect(response.status).toBe(200);
      expect(prisma.eventRegistration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: fixture.pendingRegistration.id },
          data: expect.objectContaining({ status }),
        })
      );
      expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationId: fixture.pendingRegistration.id,
            eventId: fixture.publishedEvent.id,
            actorId: fixture.mc.hacker.id,
            fromStatus: 'PENDING',
            toStatus: status,
          }),
        })
      );
      expect(notifyEventDecision).toHaveBeenCalledWith({
        eventId: fixture.publishedEvent.id,
        registrationId: fixture.pendingRegistration.id,
        status,
      });
    }
  );

  it('denies co-MC applicant decisions', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.coMc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.coMc.staff,
    });

    const response = await PATCH_REGISTRATION(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations/${fixture.pendingRegistration.id}`,
        {
          method: 'PATCH',
          body: { status: 'APPROVED' },
        }
      ) as any,
      createRouteContext({
        eventId: fixture.publishedEvent.id,
        registrationId: fixture.pendingRegistration.id,
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
  });

  it.each(buildReviewActors().filter(actor => actor.label !== 'co-MC'))(
    'allows $label decisions',
    async ({ actor, membership, staff }) => {
      const fixture = buildNativeEventRsvpFixture();
      mockReviewPermissionDatabase({
        actor,
        event: fixture.publishedEvent,
        registration: fixture.pendingRegistration,
        membership,
        staff,
      });

      const response = await PATCH_REGISTRATION(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/registrations/${fixture.pendingRegistration.id}`,
          {
            method: 'PATCH',
            body: { status: 'APPROVED' },
          }
        ) as any,
        createRouteContext({
          eventId: fixture.publishedEvent.id,
          registrationId: fixture.pendingRegistration.id,
        })
      );

      expect(response.status).toBe(200);
    }
  );

  it('defaults declined public message from the event when no explicit message is supplied', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const event = {
      ...fixture.publishedEvent,
      declineMessage: 'We cannot accommodate this application.',
    };
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });

    const response = await PATCH_REGISTRATION(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations/${fixture.pendingRegistration.id}`,
        {
          method: 'PATCH',
          body: { status: 'DECLINED' },
        }
      ) as any,
      createRouteContext({
        eventId: fixture.publishedEvent.id,
        registrationId: fixture.pendingRegistration.id,
      })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DECLINED',
          publicSafeMessage: 'We cannot accommodate this application.',
        }),
      })
    );
  });
});

describe('T053 organizer registration review internal notes API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    jest.useFakeTimers().setSystemTime(submittedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(buildReviewActors())(
    'allows $label to update event-specific internal review notes without changing applicant status',
    async ({ actor, membership, staff }) => {
      const { POST } = loadRegistrationNotesRoute();
      const fixture = buildNativeEventRsvpFixture();
      const registration = buildEventRegistration({
        id: 'registration-internal-note-target',
        eventId: fixture.publishedEvent.id,
        hackerId: fixture.applicant.id,
        status: 'PENDING',
        internalReviewNotes: 'Original organizer context.',
      });
      const internalReviewNotes =
        'Applicant is coordinating accessibility details with the MC.';

      mockReviewPermissionDatabase({
        actor,
        event: fixture.publishedEvent,
        registration,
        membership,
        staff,
        extraHackers: [fixture.applicant],
      });

      const response = await POST(
        createJsonRequest(
          `/api/events/${fixture.publishedEvent.id}/registrations/${registration.id}/notes`,
          {
            method: 'POST',
            body: { internalReviewNotes },
          }
        ) as any,
        createRouteContext({
          eventId: fixture.publishedEvent.id,
          registrationId: registration.id,
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          id: registration.id,
          eventId: fixture.publishedEvent.id,
          status: 'PENDING',
          internalReviewNotes,
        })
      );
      expect(prisma.eventRegistration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: registration.id },
          data: expect.objectContaining({
            internalReviewNotes,
          }),
        })
      );
      expect(
        prisma.eventRegistration.update.mock.calls[0][0].data
      ).not.toHaveProperty('status');
      expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationId: registration.id,
            eventId: fixture.publishedEvent.id,
            actorId: actor.id,
            fromStatus: 'PENDING',
            toStatus: 'PENDING',
          }),
        })
      );
    }
  );

  it('excludes internal review notes from duplicate public registration responses', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const internalReviewNotes =
      'Internal organizer-only decline context that must not be public.';
    const existingRegistration = buildEventRegistration({
      id: 'registration-public-duplicate-with-note',
      eventId: fixture.publishedEvent.id,
      hackerId: fixture.applicant.id,
      status: 'DECLINED',
      publicSafeMessage: 'We are not able to approve this application.',
      internalReviewNotes,
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    mockReviewPermissionDatabase({
      actor: fixture.applicant,
      event: fixture.publishedEvent,
      registration: existingRegistration,
    });

    const response = await POST_PUBLIC_REGISTRATION(
      createCurrentUserRegistrationRequest(fixture.publishedEvent.id, {
        answersJson: {
          name: fixture.applicant.name,
          email: fixture.applicant.email,
          why_this_event: 'I want to resubmit for this event.',
        },
      }) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      id: existingRegistration.id,
      status: 'DECLINED',
      submittedAt: submittedAt.toISOString(),
      publicSafeMessage: 'We are not able to approve this application.',
    });
    expect(body).not.toHaveProperty('internalReviewNotes');
    expect(JSON.stringify(body)).not.toContain(internalReviewNotes);
  });
});
