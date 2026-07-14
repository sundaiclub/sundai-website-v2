import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  forbidden,
  getCurrentHacker,
  notFound,
  unauthorized,
} from '@/lib/eventManagementApi';
import { canDecideRegistrations } from '@/lib/eventManagementAuth';
import {
  autoPromoteWaitlistAfterApprovedCancellation,
  updateEventRegistrationStatus,
} from '@/lib/eventRegistrations';
import { notifyEventDecision } from '@/lib/eventDecisionNotifications';

export async function POST(
  _req: Request,
  { params }: { params: { eventId: string; registrationId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const allowed = await canDecideRegistrations(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!allowed) return forbidden();

    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        id: params.registrationId,
        eventId: params.eventId,
      },
    });
    if (!existingRegistration) return notFound();

    const registration = await updateEventRegistrationStatus({
      registrationId: params.registrationId,
      eventId: params.eventId,
      actorId: hacker.id,
      toStatus: 'CANCELLED',
      changeJson: {
        action: 'ORGANIZER_CANCEL_REGISTRATION',
        cancelledByOrganizer: true,
      },
    });
    if (!registration) return notFound();

    const cancelledRegistration = await prisma.eventRegistration.update({
      where: { id: params.registrationId },
      data: {
        cancelledAt: new Date(),
        cancelledById: hacker.id,
      },
    });

    if (existingRegistration.status === 'APPROVED') {
      const promotion = await autoPromoteWaitlistAfterApprovedCancellation({
        eventId: params.eventId,
        triggeringRegistrationId: params.registrationId,
        actorId: hacker.id,
      });
      if (promotion.promoted) {
        await notifyEventDecision({
          eventId: params.eventId,
          registrationId: promotion.registration.id,
          status: 'APPROVED',
        });
      }
    }

    return NextResponse.json(cancelledRegistration);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_CANCEL_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
