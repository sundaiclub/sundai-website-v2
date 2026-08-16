import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';

// Delist (remove) an item from the queue
export async function DELETE(
  req: Request,
  props: { params: Promise<{ eventId: string; pitchProjectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const me = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!me) return new NextResponse('User not found', { status: 404 });

    const ep = await prisma.pitchProject.findUnique({
      where: { id: params.pitchProjectId },
      include: { pitchSession: { select: { eventId: true } } },
    });
    if (!ep || ep.pitchSession.eventId !== params.eventId)
      return new NextResponse('Not found', { status: 404 });

    // Permissions: MC/Admin can delist any; owner (addedBy) can delist their own item unless it's CURRENT
    const isOwner = ep.addedById === me.id;
    const ownerCanDelete = isOwner && ep.status !== 'CURRENT';

    if (!ownerCanDelete) {
      const pitchAccess = await requireEventPitchAccess(params.eventId);
      if (pitchAccess.response) return pitchAccess.response;
    }

    await prisma.pitchProject.delete({ where: { id: params.pitchProjectId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[QUEUE_ITEM_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
