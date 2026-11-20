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
  canDecideRegistrationsWithContext,
  canManageRegistrationsWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import { isApplicantDecisionStatus } from '@/lib/eventRegistrations';
import {
  applyRegistrationStatusChange,
  defaultDecisionMessage,
} from '@/lib/registrationDecisions';
import { privateJson } from '@/lib/publicData';
import { parseRegistrationStatus } from '@/lib/eventRequestParsing';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ eventId: string; registrationId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const permissionContext = await getEventPermissionContext(
      prisma,
      hacker.id,
      params.eventId
    );
    if (
      !permissionContext ||
      !canManageRegistrationsWithContext(permissionContext)
    ) {
      return forbidden();
    }

    const body = await req.json();
    const toStatus = parseRegistrationStatus(body?.status);
    if (toStatus === undefined) return badRequest('status is required');
    if (toStatus === null) return badRequest('status is invalid');

    if (
      isApplicantDecisionStatus(toStatus) &&
      !canDecideRegistrationsWithContext(permissionContext)
    ) {
      return forbidden();
    }

    const [previousRegistration, defaultMessage] = await Promise.all([
      prisma.eventRegistration.findFirst({
        where: { id: params.registrationId, eventId: params.eventId },
        select: { status: true },
      }),
      body.publicSafeMessage === undefined
        ? defaultDecisionMessage(params.eventId, toStatus)
        : undefined,
    ]);
    if (!previousRegistration) return notFound();

    const registration = await applyRegistrationStatusChange({
      eventId: params.eventId,
      registrationId: params.registrationId,
      actorId: hacker.id,
      previousStatus: previousRegistration.status,
      toStatus,
      publicSafeMessage:
        body.publicSafeMessage === undefined
          ? defaultMessage
          : body.publicSafeMessage,
      internalReviewNotes: body.internalReviewNotes,
      changeJson: body.changeJson,
    });
    if (!registration) return notFound();

    return privateJson({ id: registration.id, status: registration.status });
  } catch (error) {
    console.error('[EVENT_REGISTRATION_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
