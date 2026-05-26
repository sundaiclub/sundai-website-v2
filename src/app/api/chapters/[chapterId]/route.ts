import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  getCurrentHacker,
  requireChapterManager,
} from '@/lib/eventManagementApi';
import { canViewChapter as canViewChapterWithAuth } from '@/lib/eventManagementAuth';

const chapterInclude = {
  memberships: {
    where: { status: 'ACTIVE' as const, role: 'ADMIN' as const },
    include: { hacker: { select: { id: true, name: true, email: true } } },
  },
  events: {
    where: {
      status: 'PUBLISHED' as const,
      visibility: 'PUBLIC' as const,
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: 'asc' as const },
    select: {
      id: true,
      title: true,
      slug: true,
      startTime: true,
      publicLocation: true,
    },
  },
} as const;

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
      include: chapterInclude,
    });

    if (!chapter) return new NextResponse('Not Found', { status: 404 });

    const viewerMembership = hacker
      ? await prisma.chapterMembership.findFirst({
          where: {
            chapterId: resolvedChapter.id,
            hackerId: hacker.id,
          },
        })
      : null;

    const { events, ...chapterDetails } = chapter;

    return NextResponse.json({
      ...chapterDetails,
      upcomingEvents: events,
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
      'defaultDeclineMessage',
      'mailingListName',
      'mailingListExternalId',
    ] as const;
    const data: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      if (body?.[key] !== undefined) data[key] = body[key] || null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('No chapter settings were provided');
    }

    const chapter = await prisma.chapter.update({
      where: { id: resolvedChapter.id },
      data,
      include: chapterInclude,
    });

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('[CHAPTER_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
