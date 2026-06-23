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
  req: Request,
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

    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim()
        : null;

    const event = await prisma.event.update({
      where: { id: params.eventId },
      data: {
        applicationsOpen: false,
        applicationsClosedAt: new Date(),
        applicationsClosedById: hacker.id,
        applicationsCloseReason: reason,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_APPLICATIONS_CLOSE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
