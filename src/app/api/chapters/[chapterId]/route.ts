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
} as const;

export async function GET(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    const canView = await canViewChapterWithAuth(
      prisma,
      hacker?.id,
      params.chapterId
    );
    if (!canView) return new NextResponse('Not Found', { status: 404 });

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.chapterId },
      include: chapterInclude,
    });

    if (!chapter) return new NextResponse('Not Found', { status: 404 });
    return NextResponse.json(chapter);
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
    const { response } = await requireChapterManager(params.chapterId);
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
      where: { id: params.chapterId },
      data,
      include: chapterInclude,
    });

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('[CHAPTER_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
