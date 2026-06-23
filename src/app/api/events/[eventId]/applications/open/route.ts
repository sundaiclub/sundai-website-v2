import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  forbidden,
  getCurrentHacker,
  notFound,
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

    const existingEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!existingEvent) return notFound();

    const allowed = await canManageEventSettings(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!allowed) return forbidden();

    const event = await prisma.event.update({
      where: { id: params.eventId },
      data: {
        applicationsOpen: true,
        applicationsClosedAt: null,
        applicationsClosedById: null,
        applicationsCloseReason: null,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_APPLICATIONS_OPEN_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
