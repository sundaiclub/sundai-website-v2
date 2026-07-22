import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import { notifyChapterMembersOfPublishedEvent } from '@/lib/eventPublicationNotifications';

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;
    const body = (await request.json().catch(() => ({}))) as {
      notifyChapterMembers?: unknown;
    };
    const shouldNotify =
      body.notifyChapterMembers === true && access.event!.status === 'DRAFT';

    const event = await prisma.event.update({
      where: { id: params.eventId },
      data: { status: 'PUBLISHED' },
      include: {
        chapter: {
          select: { id: true, name: true, slug: true, timezone: true },
        },
        staff: {
          include: {
            hacker: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const publicationNotification = shouldNotify
      ? await notifyChapterMembersOfPublishedEvent({
          event,
          requestedById: access.hacker!.id,
        })
      : null;

    return NextResponse.json({ ...event, publicationNotification });
  } catch (error) {
    console.error('[EVENT_PUBLISH_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
