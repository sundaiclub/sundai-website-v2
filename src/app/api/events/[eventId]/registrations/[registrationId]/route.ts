import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  notFound,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  canDecideRegistrations,
  canManageRegistrations,
} from '@/lib/eventManagementAuth';
import {
  isApplicantDecisionStatus,
  updateEventRegistrationStatus,
} from '@/lib/eventRegistrations';
import { notifyEventDecision } from '@/lib/eventDecisionNotifications';
import type { RegistrationStatus } from '@/types/event-management';

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string; registrationId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const canManage = await canManageRegistrations(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!canManage) return forbidden();

    const body = await req.json();
    const toStatus = body?.status as RegistrationStatus | undefined;
    if (!toStatus) return badRequest('status is required');

    if (
      isApplicantDecisionStatus(toStatus) &&
      !(await canDecideRegistrations(prisma, hacker.id, params.eventId))
    ) {
      return forbidden();
    }

    const previousRegistration = await prisma.eventRegistration.findFirst({
      where: {
        id: params.registrationId,
        eventId: params.eventId,
      },
      select: { status: true },
    });

    let publicSafeMessage = body.publicSafeMessage;
    if (
      (toStatus === 'APPROVED' || toStatus === 'DECLINED') &&
      publicSafeMessage === undefined
    ) {
      const event = await prisma.event.findUnique({
        where: { id: params.eventId },
        select: { confirmationMessage: true, declineMessage: true },
      });
      publicSafeMessage =
        (toStatus === 'APPROVED'
          ? event?.confirmationMessage
          : event?.declineMessage) ?? undefined;
    }

    const registration = await updateEventRegistrationStatus({
      registrationId: params.registrationId,
      eventId: params.eventId,
      actorId: hacker.id,
      toStatus,
      publicSafeMessage,
      internalReviewNotes: body.internalReviewNotes,
      changeJson: body.changeJson ?? undefined,
    });

    if (!registration) return notFound();

    if (
      previousRegistration?.status !== toStatus &&
      (toStatus === 'APPROVED' || toStatus === 'DECLINED')
    ) {
      await notifyEventDecision({
        eventId: params.eventId,
        registrationId: params.registrationId,
        status: toStatus,
      });
    }

    return NextResponse.json(registration);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
