import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  requireEventStaffManager,
  requireEventWorkspaceAccess,
  unauthorized,
} from '@/lib/eventManagementApi';
import { approveEventStaffRegistrations } from '@/lib/eventStaffRegistrations';
import { sendEventEmail } from '@/lib/eventDelivery';

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
    const access = await requireEventStaffManager(params.eventId);
    if (access.response) return access.response;
    const actor = access.hacker!;
    const event = access.event!;

    let body: Record<string, unknown> | null;
    try {
      body = await request.json();
    } catch {
      return badRequest('Request body must be valid JSON.');
    }
    if (!body || typeof body !== 'object')
      return badRequest('Invalid staff assignment.');
    const byEmail = body.email !== undefined;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (
      byEmail &&
      (body.hackerId !== undefined ||
        body.role !== 'CO_MC' ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      return badRequest('Enter a valid email address and the CO_MC role.');
    if (
      (!byEmail && typeof body.hackerId !== 'string') ||
      (body.role !== 'MC' && body.role !== 'CO_MC')
    ) {
      return badRequest('A hackerId or email and a role are required.');
    }
    const targetHackerId = body.hackerId as string;
    const role = body.role;
    if (!access.administrator && role !== 'CO_MC') {
      return new NextResponse('Only admins can assign MCs.', { status: 403 });
    }

    const result = await prisma.$transaction(async tx => {
      let hackerId = targetHackerId;
      if (byEmail) {
        // Hacker emails are not unique. Serialize email assignments so two
        // organizers cannot create duplicate profiles for the same address.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${email}))`;
        const matches = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Hacker" WHERE LOWER(BTRIM(email)) = ${email}
          ORDER BY "createdAt" ASC LIMIT 2
        `;
        if (matches.length > 1) throw new Error('AMBIGUOUS_STAFF_EMAIL');
        const target =
          matches[0] ??
          (await tx.hacker.create({
            data: { email, name: email.split('@')[0], role: 'HACKER' },
            select: { id: true },
          }));
        hackerId = target.id;
      }
      const existing = await tx.eventStaff.findFirst({
        where: { eventId: event.id, hackerId },
        select: { id: true, role: true },
      });
      if (byEmail && existing?.role === 'MC')
        throw new Error('EMAIL_TARGET_IS_MC');
      if (!access.administrator && existing?.role === 'MC') {
        throw new Error('MC_ASSIGNMENT_FORBIDDEN');
      }
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
        update: access.administrator && !byEmail ? { role } : {},
        include: {
          hacker: { select: { id: true, name: true, email: true } },
        },
      });
      if (byEmail && staff.role === 'MC') throw new Error('EMAIL_TARGET_IS_MC');
      if (!access.administrator && staff.role !== 'CO_MC') {
        throw new Error('MC_ASSIGNMENT_FORBIDDEN');
      }
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

    if (byEmail) {
      const link = new URL(`/events/staff/${event.id}`, request.url).toString();
      const delivery = await sendEventEmail({
        to: email,
        subject: `Co-MC invitation: ${event.title}`,
        body: `You have been added as a co-MC for ${event.title}.\n\nOpen this page and sign in or create an account with ${email}. Verify that email address to access the event.\n\n${link}`,
      });
      return NextResponse.json(
        {
          staff: result.staff,
          delivery: {
            sent: delivery.status === 'SENT',
            link,
            message:
              delivery.status === 'SENT'
                ? null
                : 'The co-MC was added, but the email could not be sent. Share the link or submit the email address again.',
          },
        },
        { status: result.created ? 201 : 200 }
      );
    }
    return NextResponse.json(result.staff, {
      status: result.created ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AMBIGUOUS_STAFF_EMAIL') {
      return NextResponse.json(
        {
          message:
            'More than one profile uses this email. Select the person from the member list.',
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === 'EMAIL_TARGET_IS_MC') {
      return badRequest('This person is already an MC for this event.');
    }
    if (error instanceof Error && error.message === 'MC_ASSIGNMENT_FORBIDDEN') {
      return new NextResponse('Only admins can change MC assignments.', {
        status: 403,
      });
    }
    console.error('[EVENT_STAFF_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
