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
  canEditRegistrationNotes,
  canEditRegistrationNotesWithContext,
  canManageRegistrations,
  canDecideRegistrations,
  canManageRegistrationsWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import {
  countEventRegistrationsByStatus,
  createInternalEventRegistration,
  isApplicantDecisionStatus,
  listEventRegistrations,
  submitPublicEventRegistration,
} from '@/lib/eventRegistrations';
import { publicRegistrationActionResponse } from '@/lib/publicRegistrationApi';
import { parseTemplateFieldsJson } from '@/lib/applicationTemplates';
import {
  parseRegistrationSource,
  parseRegistrationStatus,
} from '@/lib/eventRequestParsing';
import type {
  JsonObject,
  OrganizerRegistrationReviewCapabilities,
  OrganizerRegistrationReviewRow,
  TemplateFieldDefinition,
} from '@/types/event-management';

function jsonObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function templateFields(value: unknown): TemplateFieldDefinition[] | null {
  if (value === null || value === undefined) return null;
  try {
    return parseTemplateFieldsJson(value, 'registration.templateSnapshotJson');
  } catch {
    return null;
  }
}

function isJsonValue(
  value: unknown
): value is import('@/types/event-management').JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonValue)
  );
}

function reviewRow(
  registration: Awaited<ReturnType<typeof listEventRegistrations>>[number],
  capabilities: OrganizerRegistrationReviewCapabilities
): OrganizerRegistrationReviewRow {
  const answers = jsonObject(registration.answersJson);
  const activeBan = capabilities.canViewBanContext
    ? (registration.hacker?.userBans?.[0] ?? null)
    : null;

  return {
    id: registration.id,
    eventId: registration.eventId,
    hackerId: registration.hackerId,
    status: registration.status,
    source: registration.source,
    applicant: registration.hacker
      ? {
          id: registration.hacker.id,
          name: registration.hacker.name,
          username: registration.hacker.username ?? null,
          email: registration.hacker.email,
          role: registration.hacker.role,
        }
      : {
          id: registration.hackerId,
          name:
            typeof answers?.name === 'string'
              ? answers.name
              : 'Unknown applicant',
          username: null,
          email: typeof answers?.email === 'string' ? answers.email : '',
          role: 'HACKER',
        },
    answersJson: answers,
    templateSnapshotJson: templateFields(registration.templateSnapshotJson),
    publicSafeMessage: registration.publicSafeMessage ?? null,
    internalReviewNotes: registration.internalReviewNotes ?? null,
    organizerNoteBody: registration.hacker?.organizerNote?.body ?? null,
    submittedAt: registration.submittedAt ?? null,
    decidedAt: registration.decidedAt ?? null,
    decidedBy: registration.decidedBy ?? null,
    cancelledAt: registration.cancelledAt ?? null,
    cancelledBy: registration.cancelledBy ?? null,
    activeBan,
    capabilities,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
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
    const canEditNotes = canEditRegistrationNotesWithContext(permissionContext);

    const siteAdmin = isSiteAdmin(hacker);
    const capabilities: OrganizerRegistrationReviewCapabilities = {
      canView: true,
      canDecide,
      canApprove: canDecide,
      canWaitlist: canDecide,
      canDecline: canDecide,
      canCancel: canDecide,
      canEditInternalNotes: canEditNotes,
      canViewBanContext: siteAdmin,
    };

    const url = new URL(req.url);
    const rawStatus = url.searchParams.get('status') ?? undefined;
    const parsedStatus = parseRegistrationStatus(rawStatus);
    if (parsedStatus === null) return badRequest('status is invalid');
    const statusFilter = parsedStatus ?? 'PENDING';
    const includeBannedUsers =
      url.searchParams.get('includeBannedUsers') === 'true';
    const [registrations, counts] = await Promise.all([
      listEventRegistrations(params.eventId, siteAdmin, {
        status: parsedStatus,
        includeBannedUsers,
        take: Number(url.searchParams.get('take') ?? 100),
        skip: Number(url.searchParams.get('skip') ?? 0),
      }),
      countEventRegistrationsByStatus(params.eventId, siteAdmin),
    ]);

    return NextResponse.json({
      eventId: params.eventId,
      statusFilter,
      includeBannedUsers,
      viewerRole: siteAdmin ? 'SITE_ADMIN' : canDecide ? 'MC' : 'CO_MC',
      counts,
      rows: registrations.map(registration =>
        reviewRow(registration, capabilities)
      ),
    });
  } catch (error) {
    console.error('[EVENT_REGISTRATIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
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
