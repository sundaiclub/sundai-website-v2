import {
  GET as GET_CHAPTERS,
  POST as POST_CHAPTERS,
} from '../../src/app/api/chapters/route';
import {
  GET as GET_CHAPTER,
  PATCH as PATCH_CHAPTER,
} from '../../src/app/api/chapters/[chapterId]/route';
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
  buildHacker,
  buildSiteAdmin,
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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chapterMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
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

describe('/api/chapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
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
            orderBy: { startTime: 'desc' },
          }),
        }),
      })
    );
  });

  it('updates chapter settings for a site admin', async () => {
    const siteAdmin = buildSiteAdmin();
    const chapter = buildChapter({ id: 'chapter-boston' });
    const updateBody = {
      name: 'Sundai Greater Boston',
      accessMode: 'PRIVATE',
      defaultDeclineMessage: 'Please apply again for a future meetup.',
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
      defaultDeclineMessage: updatedChapter.defaultDeclineMessage,
    });
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chapter.id },
        data: expect.objectContaining(updateBody),
      })
    );
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
});
