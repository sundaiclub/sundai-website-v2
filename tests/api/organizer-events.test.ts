import {
  GET as GET_EVENTS,
  POST as POST_EVENTS,
} from '../../src/app/api/events/route';
import { POST as POST_PUBLISH_EVENT } from '../../src/app/api/events/[eventId]/publish/route';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildCoMcFixture,
  buildMcFixture,
  buildPublishedEvent,
  buildSiteAdmin,
  buildUnpublishedEvent,
  type ChapterFixture,
  type ChapterMembershipFixture,
  type EventFixture,
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
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;

const createNativeEventBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'Boston AI Build Night',
  slug: 'boston-ai-build-night',
  description: 'Build practical AI tools with the Boston chapter.',
  startTime: '2026-07-10T22:00:00.000Z',
  endTime: '2026-07-11T01:00:00.000Z',
  venueName: 'Sundai Boston HQ',
  publicLocation: 'Boston, MA',
  address: '123 Builder Lane, Boston, MA 02110',
  virtualUrl: 'https://example.com/events/boston-ai-build-night/stream',
  approvedDetailsJson: {
    address: '123 Builder Lane, Boston, MA 02110',
    arrivalInstructions: 'Use the side entrance.',
  },
  programType: 'BUILD_NIGHT',
  publicProgramLabel: 'AI Build Night',
  capacity: 40,
  applicationQuestionsJson: [
    {
      id: 'why_this_event',
      label: 'Why do you want to join this event?',
      type: 'TEXTAREA',
      required: true,
      order: 10,
    },
    {
      id: 'accept_guidelines',
      label: 'I accept the event guidelines',
      type: 'CHECKBOX',
      required: true,
      order: 11,
    },
  ],
  confirmationMessage: 'Your application was submitted.',
  waitlistMessage: 'You are on the waitlist.',
  declineMessage: 'We cannot accommodate your application this time.',
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
  const findMembership = ({ where }: any) => {
    const chapterId = where?.chapterId;
    const hackerId = where?.hackerId;
    const role = typeof where?.role === 'string' ? where.role : undefined;
    const status = typeof where?.status === 'string' ? where.status : undefined;

    return (
      memberships.find(membership => {
        if (chapterId && membership.chapterId !== chapterId) return false;
        if (hackerId && membership.hackerId !== hackerId) return false;
        if (role && membership.role !== role) return false;
        if (status && membership.status !== status) return false;
        return true;
      }) ?? null
    );
  };

  prisma.chapterMembership.findFirst.mockImplementation(async (args: any) =>
    findMembership(args)
  );
  prisma.chapterMembership.findMany.mockImplementation(async ({ where }: any) =>
    memberships.filter(membership => {
      if (where?.hackerId && membership.hackerId !== where.hackerId) {
        return false;
      }
      if (where?.role && membership.role !== where.role) {
        return false;
      }
      if (where?.status && membership.status !== where.status) {
        return false;
      }
      return true;
    })
  );
};

describe('/api/events organizer chapter-admin behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('allows a chapter admin to create an event in their chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const startTime = '2026-06-10T22:00:00.000Z';
    const createdEvent = {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      chapterId: chapter.id,
      slug: 'boston-demo-night',
      startTime: new Date(startTime),
      createdById: hacker.id,
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.event.create.mockResolvedValue(createdEvent);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: {
          title: 'Boston Demo Night',
          description: 'Local chapter showcase',
          chapterId: chapter.id,
          slug: 'boston-demo-night',
          startTime,
          location: 'Sundai Boston HQ',
          meetingUrl: 'https://meet.example.com/boston-demo-night',
          audienceCanReorder: false,
        },
      }) as any
    );
    const body = await response.json();

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Boston Demo Night',
          chapterId: chapter.id,
          slug: 'boston-demo-night',
          createdById: hacker.id,
          location: 'Sundai Boston HQ',
          meetingUrl: 'https://meet.example.com/boston-demo-night',
          confirmationMessage:
            'Your registration is confirmed. We look forward to seeing you at the event.',
          waitlistMessage:
            'You are on the waitlist. We will let you know if a spot opens up.',
          declineMessage:
            'Thank you for your interest. Unfortunately, we are unable to offer you a spot at this event.',
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: createdEvent.id }));
  });

  it('creates native RSVP fields for chapter admins with approval and auto-promotion defaults', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const eventBody = createNativeEventBody({ chapterId: chapter.id });
    const createdEvent = {
      id: 'event-boston-ai-build-night',
      ...eventBody,
      applicationMode: 'REQUIRES_APPROVAL',
      autoPromoteWaitlist: false,
      createdById: hacker.id,
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
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
          title: eventBody.title,
          chapterId: chapter.id,
          slug: eventBody.slug,
          description: eventBody.description,
          publicLocation: eventBody.publicLocation,
          address: eventBody.address,
          virtualUrl: eventBody.virtualUrl,
          approvedDetailsJson: eventBody.approvedDetailsJson,
          programType: eventBody.programType,
          publicProgramLabel: eventBody.publicProgramLabel,
          capacity: eventBody.capacity,
          applicationMode: 'REQUIRES_APPROVAL',
          autoPromoteWaitlist: false,
          applicationQuestionsJson: eventBody.applicationQuestionsJson,
          confirmationMessage: eventBody.confirmationMessage,
          waitlistMessage: eventBody.waitlistMessage,
          declineMessage: eventBody.declineMessage,
          applicationsOpen: true,
          applicationsClosedAt: null,
          applicationsClosedById: null,
          createdById: hacker.id,
        }),
      })
    );
  });

  it('allows site admins to create native RSVP events for any chapter', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const eventBody = createNativeEventBody({
      chapterId: chapter.id,
      title: 'NYC AI Build Night',
      slug: 'nyc-ai-build-night',
      applicationMode: 'OPEN_RSVP',
      autoPromoteWaitlist: true,
      confirmationMessage: 'You are registered.',
      waitlistMessage: 'You are waitlisted for NYC.',
      declineMessage: 'NYC is full this time.',
    });
    const createdEvent = {
      id: 'event-nyc-ai-build-night',
      ...eventBody,
      createdById: siteAdmin.id,
    };

    mockActor(siteAdmin);
    mockMembershipLookup();
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.event.create.mockResolvedValue(createdEvent);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: eventBody,
      }) as any
    );

    expect([200, 201]).toContain(response.status);
    expect(prisma.chapterMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: chapter.id,
          title: eventBody.title,
          slug: eventBody.slug,
          applicationMode: 'OPEN_RSVP',
          autoPromoteWaitlist: true,
          confirmationMessage: eventBody.confirmationMessage,
          waitlistMessage: eventBody.waitlistMessage,
          declineMessage: eventBody.declineMessage,
          createdById: siteAdmin.id,
        }),
      })
    );
  });

  it('rejects invalid staff roles instead of coercing them to MC', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: createNativeEventBody({
          chapterId: chapter.id,
          staff: [{ hackerId: 'hacker-staff', role: 'ORGANIZER' }],
        }),
      }) as any
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'staff must contain MC or CO_MC assignments',
    });
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it('denies chapter admins creating events for another chapter', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(otherChapter);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: {
          title: 'NYC Demo Night',
          chapterId: otherChapter.id,
          startTime: '2026-06-17T22:00:00.000Z',
        },
      }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: otherChapter.id,
          hackerId: hacker.id,
        }),
      })
    );
    expect(chapter.id).not.toBe(otherChapter.id);
  });

  it.each([
    ['MC', buildMcFixture],
    ['co-MC', buildCoMcFixture],
  ])(
    'denies %s actors creating events by staff role alone',
    async (_role, buildStaffFixture) => {
      const chapter = buildChapter();
      const { hacker, staff } = buildStaffFixture({
        staff: { eventId: 'event-existing-assignment' },
      });

      mockActor(hacker);
      mockMembershipLookup();
      prisma.chapter.findUnique.mockResolvedValue(chapter);
      prisma.eventStaff.findFirst.mockResolvedValue(staff);

      const response = await POST_EVENTS(
        createJsonRequest('/api/events', {
          method: 'POST',
          body: createNativeEventBody({ chapterId: chapter.id }),
        }) as any
      );

      expect(response.status).toBe(403);
      expect(prisma.event.create).not.toHaveBeenCalled();
    }
  );

  it('filters organizer event lists to chapters the chapter admin manages', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const bostonEvent = {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      chapterId: chapter.id,
      startTime: new Date('2026-06-10T22:00:00.000Z'),
    };
    const nycEvent = {
      id: 'event-nyc-demo-night',
      title: 'NYC Demo Night',
      chapterId: otherChapter.id,
      startTime: new Date('2026-06-17T22:00:00.000Z'),
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.event.findMany.mockImplementation(async (args: any = {}) => {
      const chapterId = args.where?.chapterId;
      if (chapterId === chapter.id || chapterId?.in?.includes(chapter.id)) {
        return [bostonEvent];
      }

      return [bostonEvent, nycEvent];
    });

    const response = await GET_EVENTS(
      createJsonRequest('/api/events', {
        searchParams: { organizer: true },
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: bostonEvent.id,
        chapterId: chapter.id,
      }),
    ]);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: expect.anything(),
        }),
      })
    );
  });
});

type PublicListingEventFixture = EventFixture & {
  chapter: ChapterFixture;
  _count: { registrations: number };
};

const withPublicListingChapter = (
  event: EventFixture,
  chapter: ChapterFixture
): PublicListingEventFixture => ({
  ...event,
  chapter,
  _count: { registrations: 0 },
});

const matchesPublicListingWhere = (
  event: PublicListingEventFixture,
  where: any = {}
) => {
  if (where.status && event.status !== where.status) return false;
  if (where.visibility && event.visibility !== where.visibility) return false;
  if (where.startTime?.gte && event.startTime < where.startTime.gte) {
    return false;
  }
  if (where.chapter?.status && event.chapter.status !== where.chapter.status) {
    return false;
  }
  if (
    where.chapter?.accessMode &&
    event.chapter.accessMode !== where.chapter.accessMode
  ) {
    return false;
  }

  return true;
};

describe('/api/events organizer immediate publishing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
  });

  it('allows a chapter admin to immediately publish an event in their chapter', async () => {
    const {
      chapter,
      hacker: chapterAdmin,
      membership,
    } = buildChapterAdminFixture();
    const draftEvent = buildUnpublishedEvent({
      chapterId: chapter.id,
      createdById: chapterAdmin.id,
    });
    const publishedEvent = buildPublishedEvent({
      ...draftEvent,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });

    mockActor(chapterAdmin);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(draftEvent);
    prisma.event.update.mockResolvedValue(publishedEvent);

    const response = await POST_PUBLISH_EVENT(
      createJsonRequest(`/api/events/${draftEvent.id}/publish`, {
        method: 'POST',
      }) as any,
      createRouteContext({ eventId: draftEvent.id }) as any
    );
    const body = await response.json();

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draftEvent.id },
        data: { status: 'PUBLISHED' },
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: draftEvent.id,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      })
    );
  });

  it('allows a site admin to immediately publish an event in any chapter', async () => {
    const siteAdmin = buildSiteAdmin();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const draftEvent = buildUnpublishedEvent({
      id: 'event-nyc-unpublished-demo-night',
      chapterId: otherChapter.id,
      slug: 'nyc-unpublished-demo-night',
      title: 'NYC Unpublished Demo Night',
    });
    const publishedEvent = buildPublishedEvent({
      ...draftEvent,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });

    mockActor(siteAdmin);
    mockMembershipLookup();
    prisma.event.findUnique.mockResolvedValue(draftEvent);
    prisma.event.update.mockResolvedValue(publishedEvent);

    const response = await POST_PUBLISH_EVENT(
      createJsonRequest(`/api/events/${draftEvent.id}/publish`, {
        method: 'POST',
      }) as any,
      createRouteContext({ eventId: draftEvent.id }) as any
    );
    const body = await response.json();

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draftEvent.id },
        data: { status: 'PUBLISHED' },
      })
    );
    expect(body).toEqual(
      expect.objectContaining({
        id: draftEvent.id,
        chapterId: otherChapter.id,
        status: 'PUBLISHED',
      })
    );
  });

  it('denies chapter admins publishing events in another chapter', async () => {
    const { hacker: chapterAdmin, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const otherChapterEvent = buildUnpublishedEvent({
      id: 'event-nyc-unpublished-demo-night',
      chapterId: otherChapter.id,
      slug: 'nyc-unpublished-demo-night',
      title: 'NYC Unpublished Demo Night',
    });

    mockActor(chapterAdmin);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(otherChapterEvent);

    const response = await POST_PUBLISH_EVENT(
      createJsonRequest(`/api/events/${otherChapterEvent.id}/publish`, {
        method: 'POST',
      }) as any,
      createRouteContext({ eventId: otherChapterEvent.id }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.event.update).not.toHaveBeenCalled();
    expect(prisma.chapterMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: otherChapter.id,
          hackerId: chapterAdmin.id,
        }),
      })
    );
  });

  it.each([
    ['MC', buildMcFixture],
    ['co-MC', buildCoMcFixture],
  ])(
    'denies an assigned %s publishing an event by staff role alone',
    async (_label, buildStaffFixture) => {
      const { hacker, staff } = buildStaffFixture();
      const draftEvent = buildUnpublishedEvent({
        id: staff.eventId,
        chapterId: 'chapter-boston',
      });

      mockActor(hacker);
      mockMembershipLookup();
      prisma.event.findUnique.mockResolvedValue(draftEvent);
      prisma.eventStaff.findFirst.mockResolvedValue(staff);

      const response = await POST_PUBLISH_EVENT(
        createJsonRequest(`/api/events/${draftEvent.id}/publish`, {
          method: 'POST',
        }) as any,
        createRouteContext({ eventId: draftEvent.id }) as any
      );

      expect(response.status).toBe(403);
      expect(prisma.event.update).not.toHaveBeenCalled();
    }
  );

  it('shows published public events on public listing responses', async () => {
    const chapter = buildChapter();
    const publishedEvent = buildPublishedEvent({
      id: 'event-boston-published-demo-night',
      title: 'Boston Published Demo Night',
      slug: 'boston-published-demo-night',
      chapterId: chapter.id,
      startTime: new Date('2099-07-10T22:00:00.000Z'),
    });
    const unpublishedEvent = buildUnpublishedEvent({
      id: 'event-boston-draft-demo-night',
      title: 'Boston Draft Demo Night',
      slug: 'boston-draft-demo-night',
      chapterId: chapter.id,
      startTime: new Date('2099-07-11T22:00:00.000Z'),
    });
    const privatePublishedEvent = buildPublishedEvent({
      id: 'event-boston-private-demo-night',
      title: 'Boston Private Demo Night',
      slug: 'boston-private-demo-night',
      chapterId: chapter.id,
      visibility: 'PRIVATE',
      startTime: new Date('2099-07-12T22:00:00.000Z'),
    });
    const listingEvents = [
      withPublicListingChapter(publishedEvent, chapter),
      withPublicListingChapter(unpublishedEvent, chapter),
      withPublicListingChapter(privatePublishedEvent, chapter),
    ];

    mockSignedOutClerk();
    prisma.event.findMany.mockImplementation(async ({ where }: any = {}) =>
      listingEvents.filter(event => matchesPublicListingWhere(event, where))
    );

    const response = await GET_EVENTS(createJsonRequest('/api/events') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [
            { startTime: { gte: expect.any(Date) } },
            {
              startTime: { lt: expect.any(Date) },
              endTime: { gt: expect.any(Date) },
            },
          ],
          chapter: expect.objectContaining({
            status: 'ACTIVE',
            accessMode: 'PUBLIC',
          }),
        }),
      })
    );
    expect(body.map((event: any) => event.id)).toEqual([publishedEvent.id]);
    expect(body).toEqual([
      expect.objectContaining({
        id: publishedEvent.id,
        chapterSlug: chapter.slug,
        title: publishedEvent.title,
        publicLocation: publishedEvent.publicLocation,
      }),
    ]);
  });
});
