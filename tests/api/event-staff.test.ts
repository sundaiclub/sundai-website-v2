import { POST as POST_EVENT_STAFF } from '../../src/app/api/events/[eventId]/staff/route';
import {
  DELETE as DELETE_EVENT_STAFF_BY_ID,
} from '../../src/app/api/events/[eventId]/staff/[staffId]/route';
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
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
    },
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
        (hacker) => where?.id === hacker.id || where?.clerkId === hacker.clerkId
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
  prisma.chapterMembership.findFirst.mockImplementation(async ({ where }: any) => {
    const chapterId = where?.chapterId;
    const hackerId = where?.hackerId;
    const role = typeof where?.role === 'string' ? where.role : undefined;
    const status = typeof where?.status === 'string' ? where.status : undefined;

    return (
      memberships.find((membership) => {
        if (chapterId && membership.chapterId !== chapterId) return false;
        if (hackerId && membership.hackerId !== hackerId) return false;
        if (role && membership.role !== role) return false;
        if (status && membership.status !== status) return false;
        return true;
      }) ?? null
    );
  });
};

describe('/api/events/[eventId]/staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
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
    prisma.event.findUnique.mockResolvedValue(event);
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
          eventId_hackerId_role: {
            eventId: event.id,
            hackerId: mcHacker.id,
            role: 'MC',
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
  });

  it('allows a chapter admin to assign and remove a co-MC for their event chapter', async () => {
    const { chapter, hacker: chapterAdmin, membership } =
      buildChapterAdminFixture();
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
      createJsonRequest(
        `/api/events/${event.id}/staff/${assignedStaff.id}`,
        { method: 'DELETE' }
      ) as any,
      createRouteContext({
        eventId: event.id,
        staffId: assignedStaff.id,
      }) as any
    );

    expect(removeResponse.status).toBe(204);
    expect(prisma.eventStaff.delete).toHaveBeenCalledWith({
      where: { id: assignedStaff.id },
    });
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
