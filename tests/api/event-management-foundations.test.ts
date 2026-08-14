import { GET as GET_EVENTS, POST as POST_EVENTS } from '../../src/app/api/events/route';
import { PATCH as PATCH_EVENT } from '../../src/app/api/events/[eventId]/route';
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
  buildHacker,
  buildSiteAdmin,
  type ChapterMembershipFixture,
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
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    eventProject: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

const buildEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-boston-ai-showcase',
  chapterId: 'chapter-boston',
  slug: 'boston-ai-showcase',
  title: 'Boston AI Showcase',
  description: 'A chapter-run event for local builders.',
  startTime: new Date('2026-06-18T22:00:00.000Z'),
  endTime: new Date('2026-06-19T00:00:00.000Z'),
  status: 'DRAFT',
  visibility: 'UNLISTED',
  programType: 'demo-night',
  publicProgramLabel: 'Demo Night',
  capacity: 80,
  venueName: 'Sundai Boston HQ',
  publicLocation: 'Downtown Boston',
  address: '1 Demo Way, Boston, MA',
  virtualUrl: 'https://meet.example.com/boston-ai-showcase',
  applicationMode: 'REQUIRES_APPROVAL',
  autoPromoteWaitlist: true,
  approvedDetailsJson: {
    arrivalInstructions: 'Use the side entrance after 6pm.',
  },
  applicationQuestionsJson: [
    {
      id: 'project-url',
      label: 'Project URL',
      type: 'URL',
      required: true,
    },
  ],
  hideChapterDefaultQuestions: true,
  applicationsOpen: true,
  applicationsClosedAt: null,
  applicationsClosedById: null,
  applicationsCloseReason: 'Capacity reached',
  checkInOpensAt: new Date('2026-06-18T21:30:00.000Z'),
  checkInClosesAt: new Date('2026-06-18T23:00:00.000Z'),
  projects: [],
  staff: [],
  ...overrides,
});

const loadPublishRoute = () => {
  try {
    return require('../../src/app/api/events/[eventId]/publish/route').POST as (
      req: Request,
      context: { params: { eventId: string } }
    ) => Promise<Response>;
  } catch (error) {
    return async () => {
      throw error;
    };
  }
};

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
  const membershipMatches = (membership: ChapterMembershipFixture, where: any) => {
    if (where?.chapterId && membership.chapterId !== where.chapterId) return false;
    if (where?.hackerId && membership.hackerId !== where.hackerId) return false;
    if (where?.role && membership.role !== where.role) return false;
    if (where?.status && membership.status !== where.status) return false;
    return true;
  };

  prisma.chapterMembership.findFirst.mockImplementation(async ({ where }: any) =>
    memberships.find((membership) => membershipMatches(membership, where)) ?? null
  );
  prisma.chapterMembership.findMany.mockImplementation(async ({ where }: any) =>
    memberships.filter((membership) => membershipMatches(membership, where))
  );
};

describe('/api/events event-management foundations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.chapterMembership.findMany.mockResolvedValue([]);
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );
  });

  it('creates an event with rich metadata for an authorized chapter', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter();
    const createdEvent = buildEvent({ chapterId: chapter.id });
    const startTime = '2026-06-18T18:00';
    const endTime = '2026-06-18T20:00';
    const applicationsClosedAt = '2026-06-01T13:00:00.000Z';
    const checkInOpensAt = '2026-06-18T21:30:00.000Z';
    const checkInClosesAt = '2026-06-18T23:00:00.000Z';
    const approvedDetailsJson = {
      arrivalInstructions: 'Use the side entrance after 6pm.',
      doorCode: 'retired access value',
      toolkitUrl: 'https://example.com/retired-resource',
    };
    const applicationQuestionsJson = [
      {
        id: 'project-url',
        label: 'Project URL',
        type: 'URL',
        required: true,
      },
    ];

    mockActor(siteAdmin);
    mockMembershipLookup();
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.event.create.mockResolvedValue(createdEvent);

    const response = await POST_EVENTS(
      createJsonRequest('/api/events', {
        method: 'POST',
        body: {
          title: createdEvent.title,
          description: createdEvent.description,
          chapterId: chapter.id,
          slug: createdEvent.slug,
          startTime,
          endTime,
          timezone: 'America/New_York',
          visibility: 'UNLISTED',
          programType: 'demo-night',
          publicProgramLabel: 'Demo Night',
          capacity: 80,
          venueName: 'Sundai Boston HQ',
          publicLocation: 'Downtown Boston',
          address: '1 Demo Way, Boston, MA',
          virtualUrl: 'https://meet.example.com/boston-ai-showcase',
          applicationMode: 'REQUIRES_APPROVAL',
          autoPromoteWaitlist: true,
          approvedDetailsJson,
          applicationQuestionsJson,
          hideChapterDefaultQuestions: true,
          applicationsOpen: false,
          applicationsClosedAt,
          applicationsCloseReason: 'Capacity reached',
          checkInOpensAt,
          checkInClosesAt,
        },
      }) as any
    );
    const body = await response.json();

    expect([200, 201]).toContain(response.status);
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: createdEvent.title,
          description: createdEvent.description,
          chapterId: chapter.id,
          slug: createdEvent.slug,
          startTime: new Date('2026-06-18T22:00:00.000Z'),
          endTime: new Date('2026-06-19T00:00:00.000Z'),
          visibility: 'UNLISTED',
          programType: 'demo-night',
          publicProgramLabel: 'Demo Night',
          capacity: 80,
          venueName: 'Sundai Boston HQ',
          publicLocation: 'Downtown Boston',
          address: '1 Demo Way, Boston, MA',
          virtualUrl: 'https://meet.example.com/boston-ai-showcase',
          applicationMode: 'REQUIRES_APPROVAL',
          autoPromoteWaitlist: true,
          approvedDetailsJson: {
            arrivalInstructions: 'Use the side entrance after 6pm.',
          },
          applicationQuestionsJson,
          hideChapterDefaultQuestions: true,
          applicationsOpen: false,
          applicationsClosedAt: new Date(applicationsClosedAt),
          applicationsClosedById: siteAdmin.id,
          applicationsCloseReason: 'Capacity reached',
          checkInOpensAt: new Date(checkInOpensAt),
          checkInClosesAt: new Date(checkInClosesAt),
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: createdEvent.id }));
  });

  it('updates rich event metadata when a chapter admin manages the event chapter', async () => {
    const { chapter, hacker: chapterAdmin, membership } =
      buildChapterAdminFixture();
    const event = buildEvent({ chapterId: chapter.id });
    const updatedEvent = buildEvent({
      ...event,
      title: 'Updated Boston AI Showcase',
      visibility: 'PRIVATE',
      capacity: 64,
    });

    mockActor(chapterAdmin);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.event.update.mockResolvedValue(updatedEvent);

    const response = await PATCH_EVENT(
      createJsonRequest(`/api/events/${event.id}`, {
        method: 'PATCH',
        body: {
          title: 'Updated Boston AI Showcase',
          description: 'Updated metadata for local operators.',
          visibility: 'PRIVATE',
          capacity: 64,
          venueName: 'Updated Venue',
          publicLocation: 'Seaport',
          approvedDetailsJson: {
            wifi: 'Shared after approval.',
          },
          applicationQuestionsJson: [
            {
              id: 'team-size',
              label: 'Team size',
              type: 'NUMBER',
              required: false,
            },
          ],
          hideChapterDefaultQuestions: false,
        },
      }) as any,
      createRouteContext({ eventId: event.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: event.id },
        data: expect.objectContaining({
          title: 'Updated Boston AI Showcase',
          description: 'Updated metadata for local operators.',
          visibility: 'PRIVATE',
          capacity: 64,
          venueName: 'Updated Venue',
          publicLocation: 'Seaport',
          approvedDetailsJson: {
            wifi: 'Shared after approval.',
          },
          applicationQuestionsJson: [
            {
              id: 'team-size',
              label: 'Team size',
              type: 'NUMBER',
              required: false,
            },
          ],
          hideChapterDefaultQuestions: false,
        }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ id: event.id }));
  });

  it('publishes a draft event for a chapter admin in their chapter', async () => {
    const POST_PUBLISH_EVENT = loadPublishRoute();
    const { chapter, hacker: chapterAdmin, membership } =
      buildChapterAdminFixture();
    const draftEvent = buildEvent({
      chapterId: chapter.id,
      status: 'DRAFT',
    });
    const publishedEvent = buildEvent({
      ...draftEvent,
      status: 'PUBLISHED',
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
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      })
    );
    expect(body).toEqual(expect.objectContaining({ status: 'PUBLISHED' }));
  });

  it('denies chapter-admin metadata updates for another chapter event', async () => {
    const { hacker: chapterAdmin, membership } = buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const otherChapterEvent = buildEvent({
      id: 'event-nyc-showcase',
      chapterId: otherChapter.id,
      slug: 'nyc-showcase',
      title: 'NYC Showcase',
    });

    mockActor(chapterAdmin);
    mockMembershipLookup(membership);
    prisma.event.findUnique.mockResolvedValue(otherChapterEvent);

    const response = await PATCH_EVENT(
      createJsonRequest(`/api/events/${otherChapterEvent.id}`, {
        method: 'PATCH',
        body: {
          title: 'Unauthorized NYC Update',
          visibility: 'PRIVATE',
        },
      }) as any,
      createRouteContext({ eventId: otherChapterEvent.id }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('scopes organizer event lists to chapters managed by the chapter admin', async () => {
    const { chapter, hacker: chapterAdmin, membership } =
      buildChapterAdminFixture();
    const otherChapter = buildChapter({
      id: 'chapter-nyc',
      name: 'Sundai NYC',
      slug: 'nyc',
      city: 'New York',
      region: 'NY',
    });
    const bostonEvent = buildEvent({ chapterId: chapter.id });
    const nycEvent = buildEvent({
      id: 'event-nyc-showcase',
      chapterId: otherChapter.id,
      slug: 'nyc-showcase',
      title: 'NYC Showcase',
    });

    mockActor(chapterAdmin);
    mockMembershipLookup(membership);
    prisma.event.findMany.mockImplementation(async ({ where }: any = {}) => {
      if (where?.chapterId?.in?.includes(chapter.id)) {
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
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chapterId: { in: [chapter.id] },
        },
      })
    );
    expect(body).toEqual([
      expect.objectContaining({
        id: bostonEvent.id,
        chapterId: chapter.id,
      }),
    ]);
  });

  it('keeps signed-out event listing public and scoped to published public events', async () => {
    const publicEvent = buildEvent({
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      chapter: {
        id: 'chapter-boston',
        name: 'Sundai Boston',
        slug: 'boston',
        timezone: 'America/New_York',
      },
      _count: { registrations: 0 },
    });

    mockSignedOutClerk();
    prisma.event.findMany.mockResolvedValue([publicEvent]);

    const response = await GET_EVENTS(
      createJsonRequest('/api/events', {
        searchParams: { upcoming: true },
      }) as any
    );
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
    expect(body).toEqual([
      expect.objectContaining({
        id: publicEvent.id,
        chapterSlug: 'boston',
        publicStatus: expect.any(String),
      }),
    ]);
  });
});
