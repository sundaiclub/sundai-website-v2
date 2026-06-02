import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveChapterId } from '@/lib/chapters';
import {
  badRequest,
  notFound,
  requireChapterMemberManager,
} from '@/lib/eventManagementApi';
import { createBanFlag } from '@/lib/moderation';

export async function GET(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const chapterId = await resolveChapterId(params.chapterId);
    if (!chapterId) return notFound();

    const { response } = await requireChapterMemberManager(chapterId);
    if (response) return response;

    const flags = await prisma.userBanFlag.findMany({
      where: { chapterId },
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
        hacker: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(flags);
  } catch (error) {
    console.error('[CHAPTER_BAN_FLAGS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const chapterId = await resolveChapterId(params.chapterId);
    if (!chapterId) return notFound();

    const { hacker, response } = await requireChapterMemberManager(
      chapterId
    );
    if (response) return response;

    const body = await req.json();
    if (!body?.hackerId || !body?.reason) {
      return badRequest('hackerId and reason are required');
    }

    const flag = await createBanFlag({
      chapterId,
      hackerId: body.hackerId,
      reason: body.reason,
      createdById: hacker!.id,
    });

    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error('[CHAPTER_BAN_FLAGS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
