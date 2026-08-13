import {
  GET as GET_EVENT_STAFF,
  POST as POST_EVENT_STAFF,
} from '../../src/app/api/events/[eventId]/staff/route';
import { DELETE as DELETE_EVENT_STAFF_BY_ID } from '../../src/app/api/events/[eventId]/staff/[staffId]/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildCoMcFixture,
  buildEventStaff,
  buildEventStaffFixture,
  buildHacker,
  buildSiteAdmin,
  type ChapterMembershipFixture,
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
    chapter: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    eventStaffAudit: {
      create: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    eventRegistrationAudit: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

const buildEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-boston-demo-night',
  chapterId: 'chapter-boston',
  title: 'Boston Demo Night',
  ...overrides,
});

const mockHackerLookup = (...hackers: HackerFixture[]) => {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        hacker => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
};

const mockActor = (actor: HackerFixture, ...extraHackers: HackerFixture[]) => {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockCurrentUser({
    id: actor.clerkId,
    primaryEmailAddress: actor.email
      ? { id: `${actor.id}-email`, emailAddress: actor.email }
      : null,
  });
  mockHackerLookup(actor, ...extraHackers);
};

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  prisma.chapterMembership.findFirst.mockImplementation(
    async ({ where }: any) => {
      const chapterId = where?.chapterId;
      const hackerId = where?.hackerId;
      const role = typeof where?.role === 'string' ? where.role : undefined;
      const status =
        typeof where?.status === 'string' ? where.status : undefined;

      return (
        memberships.find(membership => {
          if (chapterId && membership.chapterId !== chapterId) return false;
          if (hackerId && membership.hackerId !== hackerId) return false;
          if (role && membership.role !== role) return false;
          if (status && membership.status !== status) return false;
          return true;
        }) ?? null
      );
    }
  );
};

describe('/api/events/[eventId]/staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.$transaction.mockImplementation(async (operation: any) =>
      typeof operation === 'function'
        ? operation(prisma)
        : Promise.all(operation)
    );
    prisma.eventStaffAudit.create.mockResolvedValue({});
    prisma.eventRegistration.findUnique.mockResolvedValue(null);
    prisma.eventRegistration.upsert.mockResolvedValue({
      id: 'registration-event-staff',
    });
    prisma.eventRegistrationAudit.create.mockResolvedValue({});
  });

  it('allows a site admin to assign an MC', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter();
    const event = buildEvent({ chapterId: chapter.id });
    const { hacker: mcHacker } = buildEventStaffFixture();
    const assignedStaff = buildEventStaff({
      id: 'event-staff-assigned-mc',
      eventId: event.id,
      hackerId: mcHacker.id,
      role: 'MC',
    });

    mockActor(siteAdmin, mcHacker);
    mockMembershipLookup();
    prisma.event.findUnique.mockImplementation(async ({ where }: any) =>
      where?.id === event.id ? event : null
    );
    prisma.eventStaff.upsert.mockResolvedValue(assignedStaff);

    const response = await POST_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`, {
        method: 'POST',
        body: { hackerId: mcHacker.id, role: 'MC' },
      }) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(prisma.eventStaff.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId_hackerId: {
            eventId: event.id,
            hackerId: mcHacker.id,
          },
        },
        create: {
          eventId: event.id,
          hackerId: mcHacker.id,
          role: 'MC',
        },
      })
    );
    expect(body).toMatchObject({
      id: assignedStaff.id,
      eventId: event.id,
      hackerId: mcHacker.id,
      role: 'MC',
    });
    expect(prisma.eventStaffAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: event.id,
          staffHackerId: mcHacker.id,
          actorId: siteAdmin.id,
          action: 'ASSIGNED',
          fromRole: null,
          toRole: 'MC',
        }),
      })
    );
    expect(prisma.eventRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId_hackerId: {
            eventId: event.id,
            hackerId: mcHacker.id,
          },
        },
        create: expect.objectContaining({
          status: 'APPROVED',
          source: 'INTERNAL',
          decidedById: siteAdmin.id,
        }),
        update: expect.objectContaining({
          status: 'APPROVED',
          cancelledAt: null,
        }),
      })
    );
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: event.id,
          actorId: siteAdmin.id,
          fromStatus: null,
          toStatus: 'APPROVED',
          changeJson: { reason: 'EVENT_STAFF_ASSIGNED' },
        }),
      })
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('allows a chapter admin to assign and remove a co-MC for their event chapter', async () => {
    const {
      chapter,
      hacker: chapterAdmin,
      membership,
    } = buildChapterAdminFixture();
    const event = buildEvent({ chapterId: chapter.id });
    const { hacker: coMcHacker } = buildCoMcFixture();
    const assignedStaff: EventStaffFixture = buildEventStaff({
      id: 'event-staff-assigned-co-mc',
      eventId: event.id,
      hackerId: coMcHacker.id,
      role: 'CO_MC',
    });

    mockActor(chapterAdmin, coMcHacker);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.eventStaff.upsert.mockResolvedValue(assignedStaff);
    prisma.eventStaff.delete.mockResolvedValue(assignedStaff);

    const assignResponse = await POST_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`, {
        method: 'POST',
        body: { hackerId: coMcHacker.id, role: 'CO_MC' },
      }) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    const assignBody = await assignResponse.json();

    expect(assignResponse.status).toBe(201);
    expect(assignBody).toMatchObject({
      id: assignedStaff.id,
      eventId: event.id,
      hackerId: coMcHacker.id,
      role: 'CO_MC',
    });
    expect(prisma.eventStaff.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventId: event.id,
          hackerId: coMcHacker.id,
          role: 'CO_MC',
        }),
      })
    );

    const removeResponse = await DELETE_EVENT_STAFF_BY_ID(
      createJsonRequest(`/api/events/${event.id}/staff/${assignedStaff.id}`, {
        method: 'DELETE',
      }) as any,
      createRouteContext({
        eventId: event.id,
        staffId: assignedStaff.id,
      }) as any
    );

    expect(removeResponse.status).toBe(204);
    expect(prisma.eventStaff.delete).toHaveBeenCalledWith({
      where: { id: assignedStaff.id },
    });
    expect(prisma.eventStaffAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: event.id,
          staffHackerId: coMcHacker.id,
          actorId: chapterAdmin.id,
          action: 'REMOVED',
          fromRole: 'CO_MC',
          toRole: null,
        }),
      })
    );
  });

  it('allows current workspace organizers to read staff and denies anonymous reads', async () => {
    const event = buildEvent();
    const { hacker: mc, staff } = buildEventStaffFixture({
      staff: { eventId: event.id },
    });
    const rows = [{ ...staff, hacker: mc }];
    mockActor(mc);
    mockMembershipLookup();
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      staff: [{ role: 'MC' }],
    });
    prisma.eventStaff.findMany.mockResolvedValue(rows);

    const allowed = await GET_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual([
      expect.objectContaining({
        id: staff.id,
        eventId: event.id,
        hackerId: mc.id,
        role: 'MC',
      }),
    ]);

    resetClerkMocks();
    const anonymous = await GET_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    expect(anonymous.status).toBe(401);
  });

  it('changes the one event assignment role and audits old and new roles atomically', async () => {
    const siteAdmin = buildSiteAdmin();
    const event = buildEvent();
    const target = buildHacker({ id: 'hacker-role-change' });
    const existing = buildEventStaff({
      eventId: event.id,
      hackerId: target.id,
      role: 'MC',
    });
    const changed = { ...existing, role: 'CO_MC' as const };
    mockActor(siteAdmin, target);
    mockMembershipLookup();
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.eventStaff.findFirst.mockResolvedValue(existing);
    prisma.eventStaff.upsert.mockResolvedValue(changed);
    prisma.eventRegistration.findUnique.mockResolvedValue({
      id: 'registration-role-change',
      status: 'CANCELLED',
      cancelledAt: new Date('2026-07-01T12:00:00.000Z'),
    });
    prisma.eventRegistration.upsert.mockResolvedValue({
      id: 'registration-role-change',
    });

    const response = await POST_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`, {
        method: 'POST',
        body: { hackerId: target.id, role: 'CO_MC' },
      }) as any,
      createRouteContext({ eventId: event.id }) as any
    );

    expect(response.status).toBe(200);
    expect(prisma.eventStaff.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId_hackerId: { eventId: event.id, hackerId: target.id },
        },
        update: { role: 'CO_MC' },
      })
    );
    expect(prisma.eventStaffAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ROLE_CHANGED',
          fromRole: 'MC',
          toRole: 'CO_MC',
        }),
      })
    );
    expect(prisma.eventRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'APPROVED',
          cancelledById: null,
          cancelledAt: null,
          waitlistedAt: null,
        }),
      })
    );
    expect(prisma.eventRegistrationAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCELLED',
          toStatus: 'APPROVED',
        }),
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('revokes workspace access immediately after audited removal', async () => {
    const siteAdmin = buildSiteAdmin();
    const event = buildEvent();
    const removedHacker = buildHacker({ id: 'hacker-removed-mc' });
    const staff = buildEventStaff({
      eventId: event.id,
      hackerId: removedHacker.id,
      role: 'MC',
    });
    mockActor(siteAdmin, removedHacker);
    mockMembershipLookup();
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.eventStaff.findFirst.mockResolvedValue(staff);
    prisma.eventStaff.delete.mockResolvedValue(staff);

    const removal = await DELETE_EVENT_STAFF_BY_ID(
      createJsonRequest(`/api/events/${event.id}/staff/${staff.id}`, {
        method: 'DELETE',
      }) as any,
      createRouteContext({ eventId: event.id, staffId: staff.id }) as any
    );
    expect(removal.status).toBe(204);
    expect(prisma.eventStaffAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'REMOVED' }),
      })
    );

    mockActor(removedHacker);
    prisma.event.findUnique.mockResolvedValue({ ...event, staff: [] });
    prisma.eventStaff.findMany.mockClear();
    const afterRemoval = await GET_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    expect(afterRemoval.status).toBe(403);
    expect(prisma.eventStaff.findMany).not.toHaveBeenCalled();
  });

  it('denies a chapter admin managing staff for another chapter', async () => {
    const { hacker: chapterAdmin, membership } = buildChapterAdminFixture();
    const otherEvent = buildEvent({ chapterId: 'chapter-cambridge' });
    const target = buildHacker({ id: 'hacker-other-chapter-mc' });
    mockActor(chapterAdmin, target);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(otherEvent);

    const response = await POST_EVENT_STAFF(
      createJsonRequest(`/api/events/${otherEvent.id}/staff`, {
        method: 'POST',
        body: { hackerId: target.id, role: 'MC' },
      }) as any,
      createRouteContext({ eventId: otherEvent.id }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
    expect(prisma.eventStaffAudit.create).not.toHaveBeenCalled();
  });

  it('denies staff assignment and removal by non-managers', async () => {
    const event = buildEvent();
    const regularHacker = buildHacker({
      id: 'hacker-regular-user',
      clerkId: 'clerk-regular-user',
      email: 'regular@example.com',
    });
    const { hacker: mcHacker } = buildEventStaffFixture();
    const staff = buildEventStaff({
      id: 'event-staff-existing-mc',
      eventId: event.id,
      hackerId: mcHacker.id,
      role: 'MC',
    });

    mockActor(regularHacker, mcHacker);
    mockMembershipLookup();
    prisma.event.findUnique.mockResolvedValue(event);

    const assignResponse = await POST_EVENT_STAFF(
      createJsonRequest(`/api/events/${event.id}/staff`, {
        method: 'POST',
        body: { hackerId: mcHacker.id, role: 'MC' },
      }) as any,
      createRouteContext({ eventId: event.id }) as any
    );

    const removeResponse = await DELETE_EVENT_STAFF_BY_ID(
      createJsonRequest(`/api/events/${event.id}/staff/${staff.id}`, {
        method: 'DELETE',
      }) as any,
      createRouteContext({
        eventId: event.id,
        staffId: staff.id,
      }) as any
    );

    expect(assignResponse.status).toBe(403);
    expect(removeResponse.status).toBe(403);
    expect(prisma.eventStaff.upsert).not.toHaveBeenCalled();
    expect(prisma.eventStaff.delete).not.toHaveBeenCalled();
  });
});
