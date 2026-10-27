import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventAdministrator } from '@/lib/eventManagementApi';

export async function POST(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventAdministrator(params.eventId);
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
