import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string; pitchProjectId: string } }
) {
  try {
    const access = await requireEventPitchAccess(params.eventId);
    if (access.response) return access.response;

    const pitchProject = await prisma.pitchProject.findUnique({
      where: { id: params.pitchProjectId },
      select: {
        pitchSession: {
          select: {
            eventId: true,
          },
        },
      },
    });
    if (!pitchProject) return new NextResponse('Unauthorized', { status: 401 });
    if (pitchProject.pitchSession.eventId !== params.eventId) {
      return new NextResponse('Not found', { status: 404 });
    }

    const { status, approved } = await req.json();

    const updated = await prisma.pitchProject.update({
      where: { id: params.pitchProjectId },
      data: {
        status: status ?? undefined,
        approved: typeof approved === 'boolean' ? approved : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[QUEUE_STATUS_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
