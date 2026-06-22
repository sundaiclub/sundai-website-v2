import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChapterMemberManager } from '@/lib/eventManagementApi';

export async function GET(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { response } = await requireChapterMemberManager(params.chapterId);
    if (response) return response;

    const members = await prisma.chapterMembership.findMany({
      where: { chapterId: params.chapterId },
      include: {
        hacker: { select: { id: true, name: true, email: true, role: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('[CHAPTER_MEMBERS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
