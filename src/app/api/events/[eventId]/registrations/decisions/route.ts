import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  canDecideRegistrationsWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import { isApplicantDecisionStatus } from '@/lib/eventRegistrations';
import {
  MAX_BULK_DECISIONS,
  applyBulkRegistrationStatus,
} from '@/lib/registrationDecisions';
import { privateJson } from '@/lib/publicData';
import { parseRegistrationStatus } from '@/lib/eventRequestParsing';
import type { RegistrationBulkDecisionResult } from '@/types/event-management';

export async function POST(
  req: Request,
  props: { params: Promise<{ eventId: string }> }
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
      !canDecideRegistrationsWithContext(permissionContext)
    ) {
      return forbidden();
    }

    const body = await req.json().catch(() => null);
    const toStatus = parseRegistrationStatus(body?.status);
    if (!toStatus || !isApplicantDecisionStatus(toStatus)) {
      return badRequest('status must be APPROVED, WAITLISTED, or DECLINED');
    }
    const registrationIds: unknown = body?.registrationIds;
    if (
      !Array.isArray(registrationIds) ||
      registrationIds.length === 0 ||
      !registrationIds.every(id => typeof id === 'string' && id.length > 0)
    ) {
      return badRequest('registrationIds must be a non-empty list of IDs');
    }
    if (registrationIds.length > MAX_BULK_DECISIONS) {
      return badRequest(
        `registrationIds can include at most ${MAX_BULK_DECISIONS} IDs`
      );
    }

    const result = await applyBulkRegistrationStatus({
      eventId: params.eventId,
      registrationIds,
      actorId: hacker.id,
      toStatus,
    });

    const response: RegistrationBulkDecisionResult = {
      status: toStatus,
      ...result,
    };
    return privateJson(response);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_BULK_DECISIONS]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
