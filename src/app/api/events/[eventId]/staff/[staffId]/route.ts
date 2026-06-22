import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';

export async function DELETE(
  _req: Request,
  { params }: { params: { eventId: string; staffId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { chapterId: true },
    });
    if (!event) return new NextResponse('Not Found', { status: 404 });
    if (!(await canManageChapterSettings(prisma, hacker.id, event.chapterId))) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    await prisma.eventStaff.delete({
      where: { id: params.staffId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[EVENT_STAFF_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
