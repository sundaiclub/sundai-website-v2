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

    await prisma.$transaction(async tx => {
      const removed = await tx.eventStaff.delete({
        where: { id: params.staffId },
      });
      if (removed.eventId !== params.eventId) {
        throw new Error('EVENT_STAFF_NOT_FOUND');
      }

      await tx.eventStaffAudit.create({
        data: {
          eventId: params.eventId,
          staffHackerId: removed.hackerId,
          actorId: hacker.id,
          action: 'REMOVED',
          fromRole: removed.role,
          toRole: null,
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025') ||
      (error instanceof Error && error.message === 'EVENT_STAFF_NOT_FOUND')
    ) {
      return new NextResponse('Not Found', { status: 404 });
    }
    console.error('[EVENT_STAFF_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
