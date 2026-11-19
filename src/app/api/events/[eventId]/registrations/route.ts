import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  isSiteAdmin,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  canDecideRegistrationsWithContext,
  canEditRegistrationNotesWithContext,
  canManageRegistrations,
  canDecideRegistrations,
  canManageRegistrationsWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import {
  createInternalEventRegistration,
  isApplicantDecisionStatus,
  submitPublicEventRegistration,
} from '@/lib/eventRegistrations';
import {
  REVIEW_QUEUE_MAX_PAGE_SIZE,
  REVIEW_QUEUE_PAGE_SIZE,
  loadRegistrationReviewQueue,
} from '@/lib/registrationReviewQueue';
import { privateJson } from '@/lib/publicData';
import { publicRegistrationActionResponse } from '@/lib/publicRegistrationApi';
import {
  parseRegistrationSource,
  parseRegistrationStatus,
} from '@/lib/eventRequestParsing';
import type {
  OrganizerRegistrationReviewCapabilities,
  OrganizerRegistrationReviewState,
} from '@/types/event-management';

const MAX_SEARCH_LENGTH = 200;

function parseCount(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function GET(
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
      !canManageRegistrationsWithContext(permissionContext)
    ) {
      return forbidden();
    }

    const canDecide = canDecideRegistrationsWithContext(permissionContext);
    const siteAdmin = isSiteAdmin(hacker);
    const capabilities: OrganizerRegistrationReviewCapabilities = {
      canView: true,
      canDecide,
      canApprove: canDecide,
      canWaitlist: canDecide,
      canDecline: canDecide,
      canCancel: canDecide,
      canEditInternalNotes:
        canEditRegistrationNotesWithContext(permissionContext),
      canViewBanContext: siteAdmin,
    };

    const url = new URL(req.url);
    const parsedStatus = parseRegistrationStatus(
      url.searchParams.get('status') ?? undefined
    );
    if (parsedStatus === null) return badRequest('status is invalid');
    const statusFilter = parsedStatus ?? 'PENDING';
    const rawOrder = url.searchParams.get('order');
    if (rawOrder !== null && rawOrder !== 'oldest' && rawOrder !== 'newest') {
      return badRequest('order is invalid');
    }
    const order = rawOrder ?? 'oldest';
    // Only a verified site administrator can opt in to banned applicants.
    const includeBannedUsers =
      siteAdmin && url.searchParams.get('includeBannedUsers') === 'true';
    const search = url.searchParams.get('q')?.slice(0, MAX_SEARCH_LENGTH);

    const queue = await loadRegistrationReviewQueue({
      eventId: params.eventId,
      status: statusFilter,
      hideBannedUsers: !includeBannedUsers,
      search,
      order,
      take: parseCount(
        url.searchParams.get('take'),
        REVIEW_QUEUE_PAGE_SIZE,
        1,
        REVIEW_QUEUE_MAX_PAGE_SIZE
      ),
      skip: parseCount(
        url.searchParams.get('skip'),
        0,
        0,
        Number.MAX_SAFE_INTEGER
      ),
      capabilities,
    });

    const body: OrganizerRegistrationReviewState = {
      eventId: params.eventId,
      statusFilter,
      includeBannedUsers,
      order,
      viewerRole: siteAdmin ? 'SITE_ADMIN' : canDecide ? 'MC' : 'CO_MC',
      ...queue,
    };
    return privateJson(body);
  } catch (error) {
    console.error('[EVENT_REGISTRATIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const body = await req.json();
    if (!body?.hackerId) {
      const result = await submitPublicEventRegistration({
        eventId: params.eventId,
        hackerId: hacker.id,
        answersJson: body?.answersJson,
        emailNotificationsEnabled: body?.emailNotificationsEnabled === true,
        smsNotificationsEnabled: body?.smsNotificationsEnabled === true,
        smsConsentGranted: body?.smsConsentGranted === true,
      });

      return publicRegistrationActionResponse(result, { successStatus: 201 });
    }

    const canManage = await canManageRegistrations(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!canManage) return forbidden();

    if (!body?.hackerId) return badRequest('hackerId is required');

    const status = parseRegistrationStatus(body.status, 'PENDING');
    if (!status) return badRequest('status is invalid');
    const source = parseRegistrationSource(body.source, 'INTERNAL');
    if (!source) return badRequest('source is invalid');
    if (
      isApplicantDecisionStatus(status) &&
      !(await canDecideRegistrations(prisma, hacker.id, params.eventId))
    ) {
      return forbidden();
    }

    const registration = await createInternalEventRegistration({
      eventId: params.eventId,
      hackerId: body.hackerId,
      actorId: hacker.id,
      status,
      source,
      answersJson: body.answersJson ?? null,
      templateSnapshotJson: body.templateSnapshotJson ?? null,
      publicSafeMessage: body.publicSafeMessage ?? null,
      internalReviewNotes: body.internalReviewNotes ?? null,
      changeJson: body.changeJson ?? undefined,
    });

    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    console.error('[EVENT_REGISTRATIONS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
