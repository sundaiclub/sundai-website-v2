import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';

export async function POST(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;

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

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_PUBLISH_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
