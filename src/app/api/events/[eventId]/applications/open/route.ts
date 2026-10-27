import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventAdministrator } from '@/lib/eventManagementApi';

export async function POST(
  _req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const { response } = await requireEventAdministrator(params.eventId);
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
