import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';

export async function POST(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { response } = await requireEventSettingsManager(params.eventId);
    if (response) return response;

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
