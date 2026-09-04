import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import { chapterEventInvitationDefaults } from '@/lib/chapterEventInvitations';

export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;
    if (access.event!.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Publish the event before inviting chapter members.' },
        { status: 409 }
      );
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: access.event!.chapterId },
      select: { name: true, slug: true },
    });
    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      chapterEventInvitationDefaults({ ...access.event!, chapter })
    );
  } catch (error) {
    console.error('[EVENT_CHAPTER_INVITATION_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
