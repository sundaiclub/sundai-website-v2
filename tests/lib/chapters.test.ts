import {
  activeChapterAdminMembershipWhere,
  listVisibleChapters,
  publicChapterWhere,
  visibleChapterWhere,
} from '../../src/lib/chapters';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildHacker,
  buildSiteAdmin,
} from '../utils/event-management-fixtures';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

describe('chapter helper indexed query shapes', () => {
  it('uses status and accessMode for signed-out public chapter visibility', () => {
    expect(visibleChapterWhere(null)).toEqual(publicChapterWhere());
    expect(publicChapterWhere()).toEqual({
      status: 'ACTIVE',
      accessMode: 'PUBLIC',
    });
  });

  it('uses membership-backed private visibility for signed-in hackers', () => {
    const hacker = buildHacker({ id: 'hacker-viewer' });

    expect(visibleChapterWhere(hacker)).toEqual({
      OR: [
        { status: 'ACTIVE', accessMode: 'PUBLIC' },
        {
          status: 'ACTIVE',
          accessMode: 'PRIVATE',
          memberships: {
            some: {
              hackerId: hacker.id,
              status: { in: ['INVITED', 'ACTIVE'] },
            },
          },
        },
        {
          memberships: {
            some: {
              hackerId: hacker.id,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          },
        },
      ],
    });
  });

  it('leaves site-admin chapter visibility unscoped', () => {
    expect(visibleChapterWhere(buildSiteAdmin())).toEqual({});
  });

  it('builds the active chapter admin membership compound lookup', () => {
    expect(
      activeChapterAdminMembershipWhere('chapter-boston', 'hacker-admin')
    ).toEqual({
      chapterId: 'chapter-boston',
      hackerId: 'hacker-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });

  it('passes visible where and viewer membership include into chapter listing', async () => {
    const nextEvent = {
      id: 'event-next',
      title: 'Next Build Night',
      slug: 'next-build-night',
      startTime: new Date('2026-07-02T22:00:00.000Z'),
      publicLocation: 'Sundai HQ',
    };
    const chapter = {
      ...buildChapter(),
      events: [nextEvent],
    };
    const { hacker } = buildChapterAdminFixture();
    const prismaClient = {
      chapter: {
        findMany: jest.fn().mockResolvedValue([chapter]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      chapterMembership: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    await expect(
      listVisibleChapters({
        viewer: hacker,
        includeViewerMembership: true,
        prismaClient,
      })
    ).resolves.toEqual([
      {
        ...buildChapter(),
        nextEvent,
      },
    ]);

    expect(prismaClient.chapter.findMany).toHaveBeenCalledWith({
      where: visibleChapterWhere(hacker),
      orderBy: { name: 'asc' },
      include: {
        heroImage: {
          select: { id: true, url: true, alt: true, filename: true },
        },
        events: {
          where: {
            status: 'PUBLISHED',
            visibility: 'PUBLIC',
            startTime: { gte: expect.any(Date) },
          },
          orderBy: { startTime: 'asc' },
          take: 1,
          select: {
            id: true,
            title: true,
            slug: true,
            startTime: true,
            publicLocation: true,
          },
        },
        memberships: {
          where: { hackerId: hacker.id },
          take: 1,
        },
      },
    });
  });
});
