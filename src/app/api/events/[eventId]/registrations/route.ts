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
  canManageRegistrations,
  canDecideRegistrations,
} from '@/lib/eventManagementAuth';
import {
  createInternalEventRegistration,
  isApplicantDecisionStatus,
  listEventRegistrations,
  submitPublicEventRegistration,
} from '@/lib/eventRegistrations';
import type { RegistrationStatus } from '@/types/event-management';
import type { PublicRegistrationActionResult } from '@/lib/eventRegistrations';

function publicRegistrationResponse(result: PublicRegistrationActionResult) {
  if (result.ok) {
    return NextResponse.json(result.registration, { status: 201 });
  }

  if (result.reason === 'VALIDATION_FAILED') {
    return NextResponse.json(
      { message: 'Application answers are invalid.', issues: result.issues },
      { status: 400 }
    );
  }

  if (result.reason === 'DUPLICATE_REGISTRATION' && result.registration) {
    return NextResponse.json(result.registration, { status: 409 });
  }

  if (result.reason === 'EVENT_NOT_FOUND') {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (result.reason === 'APPLICATIONS_CLOSED') {
    return NextResponse.json(
      { message: 'Applications are closed for this event.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ message: result.reason }, { status: 400 });
}

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const allowed = await canManageRegistrations(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!allowed) return forbidden();

    const url = new URL(req.url);
    const registrations = await listEventRegistrations(
      params.eventId,
      isSiteAdmin(hacker),
      {
        status:
          (url.searchParams.get('status') as RegistrationStatus | null) ??
          undefined,
        includeBannedUsers:
          url.searchParams.get('includeBannedUsers') === 'true',
        take: Number(url.searchParams.get('take') ?? 100),
        skip: Number(url.searchParams.get('skip') ?? 0),
      }
    );

    return NextResponse.json(registrations);
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

      return publicRegistrationResponse(result);
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
