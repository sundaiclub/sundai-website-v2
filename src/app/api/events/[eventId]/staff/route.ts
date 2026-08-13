import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  notFound,
  requireEventWorkspaceAccess,
  unauthorized,
} from '@/lib/eventManagementApi';
import { canManageEventSettings } from '@/lib/eventManagementAuth';
import { approveEventStaffRegistrations } from '@/lib/eventStaffRegistrations';

export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    if (!auth()?.userId) return unauthorized();
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const staff = await prisma.eventStaff.findMany({
      where: { eventId: params.eventId },
      include: {
        hacker: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error('[EVENT_STAFF_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const actor = await getCurrentHacker();
    if (!actor) return unauthorized();
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, chapterId: true },
    });
    if (!event) return notFound();
    if (!(await canManageEventSettings(prisma, actor.id, event.id))) {
      return forbidden();
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest('Request body must be valid JSON.');
    }
    if (
      typeof body.hackerId !== 'string' ||
      (body.role !== 'MC' && body.role !== 'CO_MC')
    ) {
      return badRequest('hackerId and role are required');
    }
    const hackerId = body.hackerId;
    const role = body.role;

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.eventStaff.findFirst({
        where: { eventId: event.id, hackerId },
        select: { id: true, role: true },
      });
      if (existing && existing.role === role) {
        await approveEventStaffRegistrations(tx, {
          eventId: event.id,
          hackerIds: [hackerId],
          actorId: actor.id,
        });
        const unchanged = await tx.eventStaff.findFirst({
          where: { id: existing.id },
          include: {
            hacker: { select: { id: true, name: true, email: true } },
          },
        });
        return { staff: unchanged, created: false };
      }

      const staff = await tx.eventStaff.upsert({
        where: {
          eventId_hackerId: {
            eventId: event.id,
            hackerId,
          },
        },
        create: {
          eventId: event.id,
          hackerId,
          role,
        },
        update: { role },
        include: {
          hacker: { select: { id: true, name: true, email: true } },
        },
      });
      await tx.eventStaffAudit.create({
        data: {
          eventId: event.id,
          staffHackerId: hackerId,
          actorId: actor.id,
          action: existing ? 'ROLE_CHANGED' : 'ASSIGNED',
          fromRole: existing?.role ?? null,
          toRole: role,
        },
      });
      await approveEventStaffRegistrations(tx, {
        eventId: event.id,
        hackerIds: [hackerId],
        actorId: actor.id,
      });
      return { staff, created: !existing };
    });

    return NextResponse.json(result.staff, {
      status: result.created ? 201 : 200,
    });
  } catch (error) {
    console.error('[EVENT_STAFF_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
