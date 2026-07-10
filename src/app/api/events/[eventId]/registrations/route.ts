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
  canEditRegistrationNotes,
  canManageRegistrations,
  canDecideRegistrations,
} from '@/lib/eventManagementAuth';
import {
  countEventRegistrationsByStatus,
  createInternalEventRegistration,
  isApplicantDecisionStatus,
  listEventRegistrations,
  submitPublicEventRegistration,
} from '@/lib/eventRegistrations';
import { publicRegistrationActionResponse } from '@/lib/publicRegistrationApi';
import type {
  JsonObject,
  OrganizerRegistrationReviewCapabilities,
  OrganizerRegistrationReviewRow,
  RegistrationStatus,
  Role,
  TemplateFieldDefinition,
} from '@/types/event-management';

function jsonObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function templateFields(value: unknown): TemplateFieldDefinition[] | null {
  return Array.isArray(value) ? (value as TemplateFieldDefinition[]) : null;
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
          role: registration.hacker.role as Role,
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

    const [allowed, canDecide, canEditNotes] = await Promise.all([
      canManageRegistrations(prisma, hacker.id, params.eventId),
      canDecideRegistrations(prisma, hacker.id, params.eventId),
      canEditRegistrationNotes(prisma, hacker.id, params.eventId),
    ]);
    if (!allowed) return forbidden();

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
    const statusFilter =
      (url.searchParams.get('status') as RegistrationStatus | null) ??
      'PENDING';
    const includeBannedUsers =
      url.searchParams.get('includeBannedUsers') === 'true';
    const [registrations, counts] = await Promise.all([
      listEventRegistrations(params.eventId, siteAdmin, {
        status:
          (url.searchParams.get('status') as RegistrationStatus | null) ??
          undefined,
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

    const status = (body.status ?? 'PENDING') as RegistrationStatus;
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
      source: body.source ?? 'INTERNAL',
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
