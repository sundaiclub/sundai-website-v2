import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import { canManageEventSettings } from '@/lib/eventManagementAuth';

export async function POST(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const allowed = await canManageEventSettings(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!allowed) return forbidden();

    const event = await prisma.event.update({
      where: { id: params.eventId },
      data: { status: 'PUBLISHED' },
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
        staff: { include: { hacker: { select: { id: true, name: true, email: true } } } },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_PUBLISH_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
