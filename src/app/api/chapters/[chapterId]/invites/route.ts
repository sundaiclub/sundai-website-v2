import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  requireChapterMemberManager,
} from '@/lib/eventManagementApi';

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
        role: body?.role ?? 'MEMBER',
        status: 'INVITED',
        invitedById: hacker!.id,
        invitedAt: new Date(),
      },
      update: {
        status: 'INVITED',
        role: body?.role ?? 'MEMBER',
        invitedById: hacker!.id,
        invitedAt: new Date(),
        revokedAt: null,
        leftAt: null,
      },
      include: { hacker: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error('[CHAPTER_INVITES_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
