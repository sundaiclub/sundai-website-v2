import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  requireChapterMemberManager,
} from '@/lib/eventManagementApi';

export async function GET(
  _req: Request,
  props: { params: Promise<{ chapterId: string }> }
) {
  const params = await props.params;
  try {
    const { response } = await requireChapterMemberManager(params.chapterId);
    if (response) return response;

    const admins = await prisma.chapterMembership.findMany({
      where: {
        chapterId: params.chapterId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      include: { hacker: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json(admins);
  } catch (error) {
    console.error('[CHAPTER_ADMINS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ chapterId: string }> }
) {
  const params = await props.params;
  try {
    const { hacker, response } = await requireChapterMemberManager(
      params.chapterId
    );
    if (response) return response;

    const body = await req.json();
    const hackerId = body?.hackerId;
    if (!hackerId) return badRequest('hackerId is required');

    const membership = await prisma.chapterMembership.upsert({
      where: {
        chapterId_hackerId: {
          chapterId: params.chapterId,
          hackerId,
        },
      },
      create: {
        chapterId: params.chapterId,
        hackerId,
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedById: hacker!.id,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
      update: {
        role: 'ADMIN',
        status: 'ACTIVE',
        revokedAt: null,
        leftAt: null,
        joinedAt: new Date(),
      },
      include: { hacker: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error('[CHAPTER_ADMINS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
