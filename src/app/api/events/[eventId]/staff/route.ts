import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { badRequest, getCurrentHacker } from '@/lib/eventManagementApi';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';

async function canAssignStaff(hackerId: string, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { chapterId: true },
  });
  if (!event) return false;
  return canManageChapterSettings(prisma, hackerId, event.chapterId);
}

export async function GET(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const staff = await prisma.eventStaff.findMany({
      where: { eventId: params.eventId },
      include: { hacker: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error('[EVENT_STAFF_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });
    if (!(await canAssignStaff(hacker.id, params.eventId))) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const body = await req.json();
    if (!body?.hackerId || (body.role !== 'MC' && body.role !== 'CO_MC')) {
      return badRequest('hackerId and role are required');
    }

    const staff = await prisma.eventStaff.upsert({
      where: {
        eventId_hackerId_role: {
          eventId: params.eventId,
          hackerId: body.hackerId,
          role: body.role,
        },
      },
      create: {
        eventId: params.eventId,
        hackerId: body.hackerId,
        role: body.role,
      },
      update: {},
      include: { hacker: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('[EVENT_STAFF_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
