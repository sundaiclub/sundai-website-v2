import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  getCurrentHacker,
  requireChapterManager,
} from '@/lib/eventManagementApi';
import {
  canManageChapterSettingsWithContext,
  canViewChapter as canViewChapterWithAuth,
} from '@/lib/eventManagementAuth';
import { isChapterTimezone } from '@/lib/chapterTimezones';

const chapterProjectSelect = {
  id: true,
  title: true,
  preview: true,
  thumbnail: { select: { id: true, url: true, alt: true } },
  launchLead: { select: { id: true, name: true } },
  techTags: { select: { id: true, name: true } },
  domainTags: { select: { id: true, name: true } },
  likes: { select: { createdAt: true } },
} as const;

function chapterInclude(now: Date) {
  return {
    heroImage: { select: { id: true, url: true, alt: true, filename: true } },
    memberships: {
      where: { status: 'ACTIVE' as const, role: 'ADMIN' as const },
      include: { hacker: { select: { id: true, name: true, email: true } } },
    },
    events: {
      where: {
        status: 'PUBLISHED' as const,
        visibility: 'PUBLIC' as const,
        startTime: { gte: now },
      },
      orderBy: { startTime: 'asc' as const },
      select: {
        id: true,
        title: true,
        slug: true,
        startTime: true,
        timezone: true,
        publicLocation: true,
        image: { select: { id: true, url: true, alt: true } },
        _count: {
          select: {
            registrations: { where: { status: { not: 'BLOCKED' as const } } },
          },
        },
        projects: {
          where: { cardStatus: 'APPROVED' as const },
          select: {
            project: { select: chapterProjectSelect },
          },
        },
      },
    },
  } as const;
}

const eventSummarySelect = {
  id: true,
  title: true,
  slug: true,
  startTime: true,
  timezone: true,
  publicLocation: true,
  status: true,
  visibility: true,
  image: { select: { id: true, url: true, alt: true } },
  _count: {
    select: {
      registrations: { where: { status: { not: 'BLOCKED' as const } } },
    },
  },
} as const;

const publicEventSummarySelect = {
  id: true,
  title: true,
  slug: true,
  startTime: true,
  endTime: true,
  timezone: true,
  publicLocation: true,
  image: { select: { id: true, url: true, alt: true } },
  _count: {
    select: {
      registrations: { where: { status: { not: 'BLOCKED' as const } } },
    },
  },
  projects: {
    where: { cardStatus: 'APPROVED' as const },
    select: {
      project: { select: chapterProjectSelect },
    },
  },
} as const;

function withApplicationCount<
  T extends { _count?: { registrations?: number } | null },
>(event: T): Omit<T, '_count'> & { applicationCount: number } {
  const { _count, ...summary } = event;
  return {
    ...summary,
    applicationCount: _count?.registrations ?? 0,
  };
}

async function resolveChapterIdentifier(chapterIdOrSlug: string) {
  return (
    (await prisma.chapter.findUnique({
      where: { id: chapterIdOrSlug },
      select: { id: true },
    })) ??
    (await prisma.chapter.findUnique({
      where: { slug: chapterIdOrSlug },
      select: { id: true },
    }))
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const now = new Date();
    const hacker = await getCurrentHacker();
    const resolvedChapter = await resolveChapterIdentifier(params.chapterId);
    if (!resolvedChapter) return new NextResponse('Not Found', { status: 404 });

    const canView = await canViewChapterWithAuth(
      prisma,
      hacker?.id,
      resolvedChapter.id
    );
    if (!canView) return new NextResponse('Not Found', { status: 404 });

    const chapter = await prisma.chapter.findUnique({
      where: { id: resolvedChapter.id },
      include: chapterInclude(now),
    });

    if (!chapter) return new NextResponse('Not Found', { status: 404 });

    const startedEvents = await prisma.event.findMany({
      where: {
        chapterId: resolvedChapter.id,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        startTime: { lt: now },
      },
      orderBy: { startTime: 'desc' },
      select: publicEventSummarySelect,
    });
    const happeningNowEvents = startedEvents.filter(
      event => event.endTime !== null && event.endTime > now
    );
    const previousEvents = startedEvents.filter(
      event => event.endTime === null || event.endTime <= now
    );

    const viewerMembership = hacker
      ? await prisma.chapterMembership.findFirst({
          where: {
            chapterId: resolvedChapter.id,
            hackerId: hacker.id,
          },
        })
      : null;
    const canManageChapter = canManageChapterSettingsWithContext({
      actor: hacker,
      membership: viewerMembership,
    });
    const pendingEvents = canManageChapter
      ? await prisma.event.findMany({
          where: {
            chapterId: resolvedChapter.id,
            status: { not: 'ARCHIVED' },
            startTime: { gte: now },
            OR: [
              { status: { not: 'PUBLISHED' } },
              { visibility: { not: 'PUBLIC' } },
            ],
          },
          orderBy: { startTime: 'asc' },
          select: eventSummarySelect,
        })
      : undefined;

    const { events = [], ...chapterDetails } = chapter;
    const projectsById = new Map<
      string,
      (typeof events)[number]['projects'][number]['project']
    >();
    for (const event of [...events, ...startedEvents]) {
      for (const participation of event.projects ?? []) {
        projectsById.set(participation.project.id, participation.project);
      }
    }

    const publicEvent = <T extends { projects?: unknown }>(event: T) => {
      const { projects: _projects, ...summary } = event;
      return withApplicationCount(summary);
    };
    const projectLikeCutoff = new Date(now);
    projectLikeCutoff.setDate(projectLikeCutoff.getDate() - 7);
    const rankedProjects = Array.from(projectsById.values()).map(project => ({
      ...project,
      likeCount: project.likes.length,
      recentLikeCount: project.likes.filter(
        like => like.createdAt >= projectLikeCutoff && like.createdAt <= now
      ).length,
    }));
    const byAllTimeLikes = (
      left: (typeof rankedProjects)[number],
      right: (typeof rankedProjects)[number]
    ) =>
      right.likeCount - left.likeCount || left.title.localeCompare(right.title);
    const serializeProject = ({
      likes: _likes,
      recentLikeCount: _recentLikeCount,
      ...project
    }: (typeof rankedProjects)[number]) => project;

    return NextResponse.json({
      ...chapterDetails,
      upcomingEvents: events.map(publicEvent),
      happeningNowEvents: happeningNowEvents.map(publicEvent),
      previousEvents: previousEvents.map(publicEvent),
      topProjectsThisWeek: [...rankedProjects]
        .sort(
          (left, right) =>
            right.recentLikeCount - left.recentLikeCount ||
            byAllTimeLikes(left, right)
        )
        .slice(0, 5)
        .map(serializeProject),
      topProjectsAllTime: [...rankedProjects]
        .sort(byAllTimeLikes)
        .slice(0, 5)
        .map(serializeProject),
      ...(pendingEvents
        ? { pendingEvents: pendingEvents.map(withApplicationCount) }
        : {}),
      viewerMembership,
    });
  } catch (error) {
    console.error('[CHAPTER_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const now = new Date();
    const resolvedChapter = await resolveChapterIdentifier(params.chapterId);
    if (!resolvedChapter) return new NextResponse('Not Found', { status: 404 });

    const { response } = await requireChapterManager(resolvedChapter.id);
    if (response) return response;

    const body = await req.json();
    const allowedKeys = [
      'name',
      'city',
      'region',
      'country',
      'timezone',
      'description',
      'status',
      'accessMode',
      'mailingListName',
      'mailingListExternalId',
    ] as const;
    const data: Record<string, unknown> = {};

    if (body?.timezone !== undefined && !isChapterTimezone(body.timezone)) {
      return badRequest('timezone must be a supported IANA timezone');
    }

    for (const key of allowedKeys) {
      if (body?.[key] !== undefined) data[key] = body[key] || null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('No chapter settings were provided');
    }

    const chapter = await prisma.chapter.update({
      where: { id: resolvedChapter.id },
      data,
      include: chapterInclude(now),
    });

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('[CHAPTER_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
