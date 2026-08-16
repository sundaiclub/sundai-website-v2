import {
  GET as GET_CHAPTERS,
  POST as POST_CHAPTERS,
} from '../../src/app/api/chapters/route';
import {
  GET as GET_CHAPTER,
  PATCH as PATCH_CHAPTER,
} from '../../src/app/api/chapters/[chapterId]/route';
import { POST as POST_CHAPTER_IMAGE } from '../../src/app/api/chapters/[chapterId]/image/route';
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
  buildChapterMembership,
  buildPublishedEvent,
  buildUnpublishedEvent,
  buildHacker,
  buildSiteAdmin,
  type ChapterFixture,
  type ChapterMembershipFixture,
  type EventFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/gcp-storage', () => ({
  uploadToGCS: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    chapter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    image: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;
const { uploadToGCS } = require('../../src/lib/gcp-storage');

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

const matchesMembershipStatus = (actual: unknown, expected: string) => {
  if (!actual) return true;
  if (typeof actual === 'string') return actual === expected;
  if (typeof actual === 'object' && actual !== null && 'in' in actual) {
    const statuses = (actual as { in?: unknown }).in;
    return Array.isArray(statuses) ? statuses.includes(expected) : false;
  }
  return false;
};

const mockMembershipLookup = (...memberships: ChapterMembershipFixture[]) => {
  prisma.chapterMembership.findFirst.mockImplementation(
    async ({ where }: any) => {
      return (
        memberships.find(membership => {
          if (where?.chapterId && membership.chapterId !== where.chapterId) {
            return false;
          }
          if (where?.hackerId && membership.hackerId !== where.hackerId) {
            return false;
          }
          if (where?.role && membership.role !== where.role) return false;
          return matchesMembershipStatus(where?.status, membership.status);
        }) ?? null
      );
    }
  );
};

const mockChapterDetailLookup = ({
  chapter,
  upcomingEvents = [],
  adminMemberships = [],
}: {
  chapter: ChapterFixture;
  upcomingEvents?: EventFixture[];
  adminMemberships?: ChapterMembershipFixture[];
}) => {
  prisma.chapter.findUnique.mockImplementation(
    async ({ where, include }: any) => {
      if (where?.id === chapter.slug) return null;
      if (where?.slug === chapter.slug) return { id: chapter.id };
      if (where?.id !== chapter.id) return null;

      if (include) {
        return {
          ...chapter,
          heroImage: null,
          memberships: adminMemberships,
          events: upcomingEvents,
        };
      }

      return chapter;
    }
  );
};

describe('/api/chapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.event.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (operation: any) => {
      if (typeof operation === 'function') return operation(prisma);
      return Promise.all(operation);
    });
  });

  it('lists every chapter for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapters = [
      buildChapter({ id: 'chapter-boston', name: 'Sundai Boston' }),
      buildChapter({
        id: 'chapter-nyc',
        name: 'Sundai NYC',
        slug: 'nyc',
        city: 'New York',
        region: 'NY',
        accessMode: 'PRIVATE',
        status: 'PAUSED',
      }),
    ];

    mockActor(siteAdmin);
    prisma.chapter.findMany.mockResolvedValue(chapters);

    const response = await GET_CHAPTERS(
      createJsonRequest('/api/chapters') as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject([
      { id: 'chapter-boston', name: 'Sundai Boston' },
      { id: 'chapter-nyc', name: 'Sundai NYC', accessMode: 'PRIVATE' },
    ]);
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('creates a chapter for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const createBody = {
      name: 'Sundai Chicago',
      slug: 'chicago',
      city: 'Chicago',
      region: 'IL',
      country: 'US',
      timezone: 'America/Chicago',
      description: 'Sundai Chicago chapter',
      accessMode: 'PUBLIC',
      status: 'ACTIVE',
    };
    const createdChapter = buildChapter({
      id: 'chapter-chicago',
      ...createBody,
    });

    mockActor(siteAdmin);
    prisma.chapter.create.mockResolvedValue(createdChapter);

    const response = await POST_CHAPTERS(
      createJsonRequest('/api/chapters', {
        method: 'POST',
        body: createBody,
      }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: createdChapter.id,
      name: createdChapter.name,
      slug: createdChapter.slug,
      accessMode: createdChapter.accessMode,
      status: createdChapter.status,
    });
    expect(prisma.chapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining(createBody),
      })
    );
  });

  it('returns chapter details for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });

    mockActor(siteAdmin);
    prisma.chapter.findUnique.mockResolvedValue(chapter);

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston') as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: chapter.id,
      name: chapter.name,
      slug: chapter.slug,
      accessMode: chapter.accessMode,
      status: chapter.status,
    });
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
      })
    );
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          events: expect.objectContaining({
            orderBy: { startTime: 'asc' },
          }),
        }),
      })
    );
  });

  it('returns public chapter detail by slug with public metadata, mailing-list CTA data, and upcoming published events', async () => {
    const chapter = buildChapter({
      id: 'chapter-boston',
      slug: 'boston',
      city: 'Boston',
      region: 'MA',
      country: 'US',
      timezone: 'America/New_York',
      description: 'Public builds and demos for Boston hackers.',
      mailingListName: 'Boston builders',
      mailingListExternalId: 'audience-boston-builders',
    });
    const upcomingEvents = [
      buildPublishedEvent({
        id: 'event-boston-demo-night',
        title: 'Boston Demo Night',
        slug: 'demo-night',
        chapterId: chapter.id,
        startTime: new Date('2026-07-18T22:00:00.000Z'),
        publicLocation: 'Kendall Square',
        _count: { registrations: 18 },
      }),
      buildPublishedEvent({
        id: 'event-boston-build-night',
        title: 'Boston Build Night',
        slug: 'build-night',
        chapterId: chapter.id,
        startTime: new Date('2026-08-01T22:00:00.000Z'),
        publicLocation: 'Seaport',
        _count: { registrations: 1 },
      }),
    ];
    const previousEvents = [
      buildPublishedEvent({
        id: 'event-boston-spring-demo',
        title: 'Boston Spring Demo',
        slug: 'spring-demo',
        chapterId: chapter.id,
        startTime: new Date('2026-05-15T22:00:00.000Z'),
        publicLocation: 'Central Square',
        _count: { registrations: 24 },
      }),
    ];
    const happeningNowEvent = buildPublishedEvent({
      id: 'event-boston-live-build',
      title: 'Boston Live Build',
      slug: 'live-build',
      chapterId: chapter.id,
      startTime: new Date('2026-05-15T18:00:00.000Z'),
      endTime: new Date('2099-05-16T01:00:00.000Z'),
      publicLocation: 'Kendall Square',
      _count: { registrations: 12 },
    });

    mockSignedOutClerk();
    mockChapterDetailLookup({ chapter, upcomingEvents });
    prisma.event.findMany.mockResolvedValue([
      happeningNowEvent,
      ...previousEvents,
    ]);

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: chapter.id,
      name: chapter.name,
      slug: chapter.slug,
      city: chapter.city,
      region: chapter.region,
      country: chapter.country,
      timezone: chapter.timezone,
      description: chapter.description,
      accessMode: 'PUBLIC',
      status: 'ACTIVE',
      mailingListName: 'Boston builders',
      mailingListExternalId: 'audience-boston-builders',
      upcomingEvents: [
        {
          id: 'event-boston-demo-night',
          title: 'Boston Demo Night',
          slug: 'demo-night',
          startTime: upcomingEvents[0].startTime.toISOString(),
          publicLocation: 'Kendall Square',
          applicationCount: 18,
        },
        {
          id: 'event-boston-build-night',
          title: 'Boston Build Night',
          slug: 'build-night',
          startTime: upcomingEvents[1].startTime.toISOString(),
          publicLocation: 'Seaport',
          applicationCount: 1,
        },
      ],
      happeningNowEvents: [
        {
          id: 'event-boston-live-build',
          title: 'Boston Live Build',
          slug: 'live-build',
          startTime: happeningNowEvent.startTime.toISOString(),
          endTime: happeningNowEvent.endTime?.toISOString(),
          publicLocation: 'Kendall Square',
          applicationCount: 12,
        },
      ],
      previousEvents: [
        {
          id: 'event-boston-spring-demo',
          title: 'Boston Spring Demo',
          slug: 'spring-demo',
          startTime: previousEvents[0].startTime.toISOString(),
          publicLocation: 'Central Square',
          applicationCount: 24,
        },
      ],
      viewerMembership: null,
    });
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: chapter.slug },
        select: { id: true },
      })
    );
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        include: expect.objectContaining({
          events: expect.objectContaining({
            where: {
              status: 'PUBLISHED',
              visibility: 'PUBLIC',
              startTime: { gte: expect.any(Date) },
            },
            select: expect.objectContaining({
              id: true,
              title: true,
              slug: true,
              startTime: true,
              publicLocation: true,
              image: { select: { id: true, url: true, alt: true } },
              _count: {
                select: {
                  registrations: {
                    where: { status: { not: 'BLOCKED' } },
                  },
                },
              },
            }),
          }),
        }),
      })
    );
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: {
        chapterId: chapter.id,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        startTime: { lt: expect.any(Date) },
      },
      orderBy: { startTime: 'desc' },
      select: expect.objectContaining({
        id: true,
        title: true,
        slug: true,
        startTime: true,
        publicLocation: true,
        image: { select: { id: true, url: true, alt: true } },
        _count: {
          select: {
            registrations: { where: { status: { not: 'BLOCKED' } } },
          },
        },
      }),
    });
  });

  it('ranks chapter projects by recent and all-time likes', async () => {
    const chapter = buildChapter({ id: 'chapter-boston', slug: 'boston' });
    const recentLike = { createdAt: new Date() };
    const oldLike = { createdAt: new Date('2025-01-01T12:00:00.000Z') };
    const project = (
      id: string,
      title: string,
      likes: (typeof recentLike)[]
    ) => ({
      id,
      title,
      preview: `${title} preview`,
      thumbnail: null,
      launchLead: { id: `${id}-lead`, name: `${title} Lead` },
      techTags: [],
      domainTags: [],
      likes,
    });
    const recentFavorite = project('project-recent', 'Recent Favorite', [
      recentLike,
      recentLike,
    ]);
    const allTimeFavorite = project('project-all-time', 'All Time Favorite', [
      oldLike,
      oldLike,
      oldLike,
    ]);

    mockSignedOutClerk();
    mockChapterDetailLookup({
      chapter,
      upcomingEvents: [
        {
          ...buildPublishedEvent({
            id: 'event-project-ranking',
            chapterId: chapter.id,
          }),
          _count: { registrations: 0 },
          projects: [{ project: allTimeFavorite }, { project: recentFavorite }],
        } as any,
      ],
    });
    prisma.event.findMany.mockResolvedValue([]);

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );
    const body = await response.json();

    expect(body.topProjectsThisWeek.map((item: any) => item.id)).toEqual([
      'project-recent',
      'project-all-time',
    ]);
    expect(body.topProjectsAllTime.map((item: any) => item.id)).toEqual([
      'project-all-time',
      'project-recent',
    ]);
    expect(body.topProjectsAllTime[0]).toMatchObject({ likeCount: 3 });
    expect(body.topProjectsAllTime[0]).not.toHaveProperty('likes');
  });

  it('returns manager-only pending events for chapter admins', async () => {
    const chapter = buildChapter({
      id: 'chapter-boston',
      slug: 'boston',
    });
    const hacker = buildHacker({
      id: 'hacker-boston-admin',
      clerkId: 'clerk-boston-admin',
    });
    const membership = buildChapterMembership({
      id: 'membership-boston-admin',
      chapterId: chapter.id,
      hackerId: hacker.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    const draftEvent = buildUnpublishedEvent({
      id: 'event-boston-draft-night',
      title: 'Boston Draft Night',
      slug: 'draft-night',
      chapterId: chapter.id,
      startTime: new Date('2026-07-18T22:00:00.000Z'),
      publicLocation: 'TBD',
    });

    mockActor(hacker);
    mockMembershipLookup(membership);
    mockChapterDetailLookup({ chapter, adminMemberships: [membership] });
    prisma.event.findMany.mockImplementation(async ({ where }: any) =>
      where?.startTime?.lt ? [] : [draftEvent]
    );

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/boston') as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pendingEvents).toEqual([
      expect.objectContaining({
        id: draftEvent.id,
        title: draftEvent.title,
        slug: draftEvent.slug,
        status: 'DRAFT',
      }),
    ]);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chapterId: chapter.id,
          status: { not: 'ARCHIVED' },
          startTime: { gte: expect.any(Date) },
          OR: [
            { status: { not: 'PUBLISHED' } },
            { visibility: { not: 'PUBLIC' } },
          ],
        }),
        orderBy: { startTime: 'asc' },
        select: expect.objectContaining({
          id: true,
          title: true,
          slug: true,
          status: true,
          visibility: true,
        }),
      })
    );
  });

  it('returns private chapter detail by slug to invited hackers with viewer membership state', async () => {
    const hacker = buildHacker({
      id: 'hacker-invited',
      clerkId: 'clerk-invited',
    });
    const chapter = buildChapter({
      id: 'chapter-cambridge-private',
      slug: 'cambridge-private',
      name: 'Sundai Cambridge Private',
      accessMode: 'PRIVATE',
      mailingListName: 'Cambridge builders',
      mailingListExternalId: 'audience-cambridge-builders',
    });
    const invitedMembership = buildChapterMembership({
      id: 'membership-cambridge-invited',
      chapterId: chapter.id,
      hackerId: hacker.id,
      status: 'INVITED',
      joinedAt: null,
    });

    mockActor(hacker);
    mockMembershipLookup(invitedMembership);
    mockChapterDetailLookup({ chapter });

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/cambridge-private') as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: chapter.id,
      slug: chapter.slug,
      accessMode: 'PRIVATE',
      mailingListName: 'Cambridge builders',
      mailingListExternalId: 'audience-cambridge-builders',
      viewerMembership: {
        id: invitedMembership.id,
        role: 'MEMBER',
        status: 'INVITED',
      },
    });
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: chapter.slug },
        select: { id: true },
      })
    );
  });

  it('hides private chapter detail by slug from outsiders and does not load landing data', async () => {
    const hacker = buildHacker({
      id: 'hacker-outsider',
      clerkId: 'clerk-outsider',
    });
    const chapter = buildChapter({
      id: 'chapter-cambridge-private',
      slug: 'cambridge-private',
      accessMode: 'PRIVATE',
    });

    mockActor(hacker);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    mockChapterDetailLookup({ chapter });

    const response = await GET_CHAPTER(
      createJsonRequest('/api/chapters/cambridge-private') as any,
      createRouteContext({ chapterId: chapter.slug }) as any
    );

    expect(response.status).toBe(404);
    expect(prisma.chapter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: chapter.slug },
        select: { id: true },
      })
    );
    expect(prisma.chapter.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
      })
    );
  });

  it('updates chapter settings for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });
    const updateBody = {
      name: 'Sundai Greater Boston',
      accessMode: 'PRIVATE',
      description: 'Greater Boston builders and demos.',
      timezone: 'Europe/Berlin',
    };
    const updatedChapter = buildChapter({
      ...chapter,
      ...updateBody,
    });

    mockActor(siteAdmin);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapter.update.mockResolvedValue(updatedChapter);

    const response = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: updateBody,
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: updatedChapter.id,
      name: updatedChapter.name,
      accessMode: updatedChapter.accessMode,
      description: updatedChapter.description,
    });
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: expect.objectContaining(updateBody),
      })
    );
  });

  it('rejects a blank chapter name', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });

    mockActor(siteAdmin);
    prisma.chapter.findUnique.mockResolvedValue(chapter);

    const response = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: { name: '   ' },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );

    expect(response.status).toBe(400);
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });

  it('lets a chapter admin update chapter decision message defaults', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const updateBody = {
      defaultApprovalMessage: 'Welcome to the Boston event.',
      defaultWaitlistMessage: 'You are on the Boston waitlist.',
      defaultRejectionMessage: 'Boston cannot offer you a spot this time.',
    };

    mockActor(hacker);
    mockMembershipLookup(membership);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapter.update.mockResolvedValue({ ...chapter, ...updateBody });

    const response = await PATCH_CHAPTER(
      createJsonRequest(`/api/chapters/${chapter.id}`, {
        method: 'PATCH',
        body: updateBody,
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );

    expect(response.status).toBe(200);
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: updateBody,
      })
    );
  });

  it('rejects an unsupported chapter timezone', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });

    mockActor(siteAdmin);
    prisma.chapter.findUnique.mockResolvedValue(chapter);

    const response = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: { timezone: 'EST' },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );

    expect(response.status).toBe(400);
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });

  it('requires authentication to create chapters', async () => {
    mockSignedOutClerk();

    const response = await POST_CHAPTERS(
      createJsonRequest('/api/chapters', {
        method: 'POST',
        body: {
          name: 'Sundai Chicago',
          slug: 'chicago',
          city: 'Chicago',
          country: 'US',
          timezone: 'America/Chicago',
        },
      }) as any
    );

    expect(response.status).toBe(401);
    expect(prisma.chapter.create).not.toHaveBeenCalled();
  });

  it('denies non-site-admin chapter creation and settings updates', async () => {
    const hacker = buildHacker({
      id: 'hacker-regular',
      clerkId: 'clerk-regular',
      role: 'HACKER',
    });
    const chapter = buildChapter({ id: 'chapter-boston' });

    mockActor(hacker);
    prisma.chapter.findUnique.mockResolvedValue(chapter);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);

    const createResponse = await POST_CHAPTERS(
      createJsonRequest('/api/chapters', {
        method: 'POST',
        body: {
          name: 'Sundai Chicago',
          slug: 'chicago',
          city: 'Chicago',
          country: 'US',
          timezone: 'America/Chicago',
        },
      }) as any
    );
    const patchResponse = await PATCH_CHAPTER(
      createJsonRequest('/api/chapters/chapter-boston', {
        method: 'PATCH',
        body: { name: 'Hidden Admin Control' },
      }) as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );

    expect(createResponse.status).toBe(403);
    expect(patchResponse.status).toBe(403);
    expect(prisma.chapter.create).not.toHaveBeenCalled();
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });

  it('lets a chapter admin upload a chapter image', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture({
      chapter: { heroImageId: 'image-old' },
    });
    const newImage = {
      id: 'image-new',
      url: 'https://storage.googleapis.com/test-bucket/chapters/boston.jpg',
      alt: 'Sundai Boston chapter image',
      filename: 'boston.jpg',
    };
    const updatedChapter = {
      ...chapter,
      heroImageId: newImage.id,
      heroImage: newImage,
    };
    const formData = new FormData();
    formData.append(
      'file',
      new File(['image-bytes'], 'boston.jpg', { type: 'image/jpeg' })
    );

    mockActor(hacker);
    prisma.chapter.findUnique
      .mockResolvedValueOnce({ id: chapter.id })
      .mockResolvedValueOnce({
        id: chapter.id,
        name: chapter.name,
        heroImageId: 'image-old',
      });
    prisma.chapterMembership.findFirst.mockResolvedValue(membership);
    uploadToGCS.mockResolvedValue({
      url: newImage.url,
      filename: 'chapters/boston.jpg',
    });
    prisma.image.create.mockResolvedValue(newImage);
    prisma.image.delete.mockResolvedValue({ id: 'image-old' });
    prisma.chapter.update.mockResolvedValue(updatedChapter);

    const response = await POST_CHAPTER_IMAGE(
      { formData: jest.fn().mockResolvedValue(formData) } as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadToGCS).toHaveBeenCalledWith(expect.any(File), 'chapters');
    expect(prisma.image.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'chapters/boston.jpg',
          url: newImage.url,
          filename: 'boston.jpg',
          mimeType: 'image/jpeg',
        }),
      })
    );
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: { heroImage: { connect: { id: newImage.id } } },
      })
    );
    expect(prisma.image.delete).toHaveBeenCalledWith({
      where: { id: 'image-old' },
    });
    expect(body).toMatchObject({
      id: chapter.id,
      heroImage: expect.objectContaining({ url: newImage.url }),
    });
  });

  it('returns 413 when a chapter image is too large', async () => {
    const { chapter, hacker, membership } = buildChapterAdminFixture();
    const file = new File(['image'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 });
    const formData = new FormData();
    formData.append('file', file);

    mockActor(hacker);
    prisma.chapter.findUnique.mockResolvedValue({ id: chapter.id });
    prisma.chapterMembership.findFirst.mockResolvedValue(membership);

    const response = await POST_CHAPTER_IMAGE(
      { formData: jest.fn().mockResolvedValue(formData) } as any,
      createRouteContext({ chapterId: chapter.id }) as any
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: 'File too large. Image files must be smaller than 15 MB.',
    });
    expect(uploadToGCS).not.toHaveBeenCalled();
  });
});
