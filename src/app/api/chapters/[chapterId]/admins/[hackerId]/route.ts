import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChapterMemberManager } from '@/lib/eventManagementApi';

export async function DELETE(
  _req: Request,
  { params }: { params: { chapterId: string; hackerId: string } }
) {
  try {
    const { response } = await requireChapterMemberManager(params.chapterId);
    if (response) return response;

    const activeAdminCount = await prisma.chapterMembership.count({
      where: {
        chapterId: params.chapterId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const membership = await prisma.chapterMembership.findUnique({
      where: {
        chapterId_hackerId: {
          chapterId: params.chapterId,
          hackerId: params.hackerId,
        },
      },
    });

    if (!membership || membership.role !== 'ADMIN') {
      return new NextResponse('Not Found', { status: 404 });
    }

    if (membership.status === 'ACTIVE' && activeAdminCount <= 1) {
      return NextResponse.json(
        { message: 'A chapter must keep at least one active admin' },
        { status: 400 }
      );
    }

    const updated = await prisma.chapterMembership.update({
      where: { id: membership.id },
      data: {
        role: 'MEMBER',
      },
      include: { hacker: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CHAPTER_ADMIN_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
