import {
  GET as GET_REGISTRATIONS,
  POST as POST_PUBLIC_REGISTRATION,
} from '../../src/app/api/events/[eventId]/registrations/route';
import { PATCH as PATCH_REGISTRATION } from '../../src/app/api/events/[eventId]/registrations/[registrationId]/route';
import { POST as POST_BULK_DECISIONS } from '../../src/app/api/events/[eventId]/registrations/decisions/route';
import {
  createCurrentUserRegistrationRequest,
  createJsonRequest,
  createRouteContext,
  createSiteAdminIncludeBannedRegistrationsRequest,
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
      groupBy: jest.fn().mockResolvedValue([]),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([]),
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
  bannedHackerIds: string[] = [],
  hackers: HackerFixture[] = []
) {
  const withHacker = (registration: EventRegistrationFixture) => {
    const hacker = hackers.find(
      candidate => candidate.id === registration.hackerId
    );
    if (!hacker) {
      throw new Error(`Missing hacker fixture for ${registration.hackerId}`);
    }
    return {
      ...registration,
      hacker: {
        id: hacker.id,
        name: hacker.name,
        username: null,
        email: hacker.email,
        role: hacker.role,
        organizerNote: null,
        userBans: bannedHackerIds.includes(hacker.id)
          ? [
              {
                id: `ban-${hacker.id}`,
                publicSafeReason: 'Fake public ban reason.',
                createdAt: submittedAt,
              },
            ]
          : [],
      },
      decidedBy: null,
      cancelledBy: null,
    };
  };
  const visible = (where: any = {}) =>
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
    });

  prisma.eventRegistration.findMany.mockImplementation(
    async ({ where }: any = {}) => visible(where).map(withHacker)
  );
  prisma.eventRegistration.groupBy.mockImplementation(
    async ({ by, where }: any = {}) => {
      if (by.includes('hackerId')) return [];
      const counts = new Map<string, number>();
      for (const registration of visible(where)) {
        counts.set(
          registration.status,
          (counts.get(registration.status) ?? 0) + 1
        );
      }
      return [...counts].map(([status, count]) => ({
        status,
        _count: { _all: count },
      }));
    }
  );
}

function fixtureApplicants(
  fixture: ReturnType<typeof buildNativeEventRsvpFixture>
) {
  return [
    fixture.applicant,
    fixture.approvedApplicant,
    fixture.waitlistedApplicant,
    fixture.bannedApplicant,
  ];
}

function listRequest(eventId: string, searchParams: Record<string, string>) {
  return createJsonRequest(`/api/events/${eventId}/registrations`, {
    searchParams,
  }) as any;
}

describe('T051 organizer registration review listing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.eventRegistration.groupBy.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
  });

  it('filters registration review rows by requested status with one counts query', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList(
      [
        fixture.pendingRegistration,
        fixture.approvedRegistration,
        fixture.waitlistedRegistration,
      ],
      [],
      fixtureApplicants(fixture)
    );

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'PENDING' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId: fixture.publishedEvent.id,
        hacker: { userBans: { none: { revokedAt: null } } },
        status: 'PENDING',
      },
      include: expect.objectContaining({ hacker: expect.any(Object) }),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: 0,
    });
    expect(prisma.eventRegistration.count).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        statusFilter: 'PENDING',
        order: 'oldest',
        capacity: fixture.publishedEvent.capacity ?? null,
        hasMore: false,
        counts: { PENDING: 1, APPROVED: 1, WAITLISTED: 1 },
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

  it('applies search, sort order, and clamped pagination', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList(
      [fixture.pendingRegistration],
      [],
      fixtureApplicants(fixture)
    );

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, {
        status: 'PENDING',
        q: 'applicant',
        order: 'newest',
        take: '5000',
        skip: '-4',
      }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(200);
    const args = prisma.eventRegistration.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual(
      expect.arrayContaining([
        { hacker: { email: { contains: 'applicant', mode: 'insensitive' } } },
      ])
    );
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args.take).toBe(101);
    expect(args.skip).toBe(0);
  });

  it('rejects an unknown sort order', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { order: 'random' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(400);
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('gives co-MCs a note-only queue', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.coMc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.coMc.staff,
    });
    mockRegistrationList(
      [fixture.pendingRegistration],
      [],
      fixtureApplicants(fixture)
    );

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'PENDING' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.viewerRole).toBe('CO_MC');
    expect(body.rows[0].capabilities).toEqual(
      expect.objectContaining({
        canDecide: false,
        canApprove: false,
        canEditInternalNotes: true,
        canViewBanContext: false,
      })
    );
  });

  it('denies registration review to unrelated signed-in users', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.applicant,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
    });

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'PENDING' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(403);
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('denies registration review to anonymous users', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockSignedOutClerk();

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'PENDING' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(401);
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('includes each applicant history from other events and public projects', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList(
      [fixture.pendingRegistration],
      [],
      fixtureApplicants(fixture)
    );
    const countGroups =
      prisma.eventRegistration.groupBy.getMockImplementation();
    prisma.eventRegistration.groupBy.mockImplementation(async (args: any) =>
      args.by.includes('hackerId')
        ? [
            {
              hackerId: fixture.applicant.id,
              status: 'APPROVED',
              _count: { _all: 2 },
            },
            {
              hackerId: fixture.applicant.id,
              status: 'DECLINED',
              _count: { _all: 1 },
            },
          ]
        : countGroups!(args)
    );
    prisma.project.findMany.mockResolvedValueOnce([
      { launchLeadId: fixture.applicant.id, participants: [] },
      {
        launchLeadId: 'hacker-someone-else',
        participants: [{ hackerId: fixture.applicant.id }],
      },
    ]);

    const response = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'PENDING' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.eventRegistration.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hackerId: { in: [fixture.applicant.id] },
          eventId: { not: fixture.publishedEvent.id },
        },
      })
    );
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ status: 'APPROVED' }),
          ]),
        }),
      })
    );
    expect(body.rows[0].applicantHistory).toEqual({
      otherEventsApplied: 3,
      otherEventsAccepted: 2,
      publicProjects: 2,
    });
  });

  it('hides actively banned applicants from non-site-admin registration review, even when they ask to include them', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockRegistrationList(
      [fixture.blockedRegistration, fixture.pendingRegistration],
      [fixture.bannedApplicant.id],
      fixtureApplicants(fixture)
    );

    for (const status of ['PENDING', 'BLOCKED']) {
      const response = await GET_REGISTRATIONS(
        listRequest(fixture.publishedEvent.id, {
          status,
          includeBannedUsers: 'true',
        }),
        createRouteContext({ eventId: fixture.publishedEvent.id })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.includeBannedUsers).toBe(false);
      expect(body.counts).not.toHaveProperty('BLOCKED');
      expect(JSON.stringify(body)).not.toContain(fixture.bannedApplicant.id);
      expect(JSON.stringify(body)).not.toContain(
        fixture.ban.internalNote ?? 'missing-note'
      );
    }
  });

  it('hides banned users from site admins until they include them', async () => {
    const fixture = buildNativeEventRsvpFixture();
    const siteAdmin = buildSiteAdmin();
    mockReviewPermissionDatabase({
      actor: siteAdmin,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
    });
    mockRegistrationList(
      [fixture.blockedRegistration, fixture.pendingRegistration],
      [fixture.bannedApplicant.id],
      fixtureApplicants(fixture)
    );

    const hiddenResponse = await GET_REGISTRATIONS(
      listRequest(fixture.publishedEvent.id, { status: 'BLOCKED' }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const hiddenBody = await hiddenResponse.json();
    expect(hiddenBody.rows).toEqual([]);
    expect(hiddenBody.counts).not.toHaveProperty('BLOCKED');

    const response = await GET_REGISTRATIONS(
      createSiteAdminIncludeBannedRegistrationsRequest(
        fixture.publishedEvent.id,
        { searchParams: { status: 'BLOCKED' } }
      ) as any,
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.includeBannedUsers).toBe(true);
    expect(body.counts).toEqual(expect.objectContaining({ BLOCKED: 1 }));
    expect(body.rows).toEqual([
      expect.objectContaining({
        id: fixture.blockedRegistration.id,
        hackerId: fixture.bannedApplicant.id,
        capabilities: expect.objectContaining({ canViewBanContext: true }),
      }),
    ]);
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

describe('organizer registration decision responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('returns only the registration ID and status after a decision', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: {
        ...fixture.pendingRegistration,
        internalReviewNotes: 'Fake private review note.',
      },
      staff: fixture.mc.staff,
    });

    const response = await PATCH_REGISTRATION(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations/${fixture.pendingRegistration.id}`,
        { method: 'PATCH', body: { status: 'APPROVED' } }
      ) as any,
      createRouteContext({
        eventId: fixture.publishedEvent.id,
        registrationId: fixture.pendingRegistration.id,
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      id: fixture.pendingRegistration.id,
      status: 'APPROVED',
    });
  });

  it('returns 404 for a registration from another event', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });

    const response = await PATCH_REGISTRATION(
      createJsonRequest(
        `/api/events/${fixture.publishedEvent.id}/registrations/registration-elsewhere`,
        { method: 'PATCH', body: { status: 'APPROVED' } }
      ) as any,
      createRouteContext({
        eventId: fixture.publishedEvent.id,
        registrationId: 'registration-elsewhere',
      })
    );

    expect(response.status).toBe(404);
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
    expect(notifyEventDecision).not.toHaveBeenCalled();
  });
});

describe('organizer bulk registration decisions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  function bulkRequest(eventId: string, body: unknown) {
    return createJsonRequest(`/api/events/${eventId}/registrations/decisions`, {
      method: 'POST',
      body,
    }) as any;
  }

  function mockBulkRegistrations(
    eventId: string,
    registrations: EventRegistrationFixture[]
  ) {
    prisma.eventRegistration.findMany.mockImplementation(
      async ({ where }: any) =>
        registrations
          .filter(
            registration =>
              registration.eventId === where.eventId &&
              where.id.in.includes(registration.id)
          )
          .map(({ id, status }) => ({ id, status }))
    );
    prisma.eventRegistration.findFirst.mockImplementation(
      async ({ where }: any) =>
        registrations.find(
          registration =>
            registration.id === where?.id && registration.eventId === eventId
        ) ?? null
    );
  }

  it('lets MCs decide several registrations with an audit entry and message each', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });
    mockBulkRegistrations(fixture.publishedEvent.id, [
      fixture.pendingRegistration,
      fixture.waitlistedRegistration,
    ]);

    const response = await POST_BULK_DECISIONS(
      bulkRequest(fixture.publishedEvent.id, {
        status: 'APPROVED',
        registrationIds: [
          fixture.pendingRegistration.id,
          fixture.waitlistedRegistration.id,
          'registration-from-another-event',
        ],
      }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body).toEqual({
      status: 'APPROVED',
      updatedIds: [
        fixture.pendingRegistration.id,
        fixture.waitlistedRegistration.id,
      ],
      failedIds: ['registration-from-another-event'],
    });
    expect(prisma.eventRegistration.update).toHaveBeenCalledTimes(2);
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledTimes(2);
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: fixture.mc.hacker.id,
          toStatus: 'APPROVED',
          changeJson: {
            action: 'BULK_UPDATE_REGISTRATION_STATUS',
            batchSize: 3,
          },
        }),
      })
    );
    expect(notifyEventDecision).toHaveBeenCalledTimes(2);
  });

  it('denies bulk decisions to co-MCs', async () => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.coMc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.coMc.staff,
    });

    const response = await POST_BULK_DECISIONS(
      bulkRequest(fixture.publishedEvent.id, {
        status: 'APPROVED',
        registrationIds: [fixture.pendingRegistration.id],
      }),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(403);
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-decision status', { status: 'CANCELLED', registrationIds: ['a'] }],
    ['an empty list', { status: 'APPROVED', registrationIds: [] }],
    ['non-string IDs', { status: 'APPROVED', registrationIds: [42] }],
    [
      'too many IDs',
      {
        status: 'APPROVED',
        registrationIds: Array.from({ length: 101 }, (_, index) => `r${index}`),
      },
    ],
  ])('rejects %s', async (_label, body) => {
    const fixture = buildNativeEventRsvpFixture();
    mockReviewPermissionDatabase({
      actor: fixture.mc.hacker,
      event: fixture.publishedEvent,
      registration: fixture.pendingRegistration,
      staff: fixture.mc.staff,
    });

    const response = await POST_BULK_DECISIONS(
      bulkRequest(fixture.publishedEvent.id, body),
      createRouteContext({ eventId: fixture.publishedEvent.id })
    );

    expect(response.status).toBe(400);
    expect(prisma.eventRegistration.update).not.toHaveBeenCalled();
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
