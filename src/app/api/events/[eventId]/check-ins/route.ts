import { NextResponse } from 'next/server';
import {
  badRequest,
  requireEventWorkspaceAccess,
} from '@/lib/eventManagementApi';
import {
  checkInEventRegistration,
  listEventCheckIns,
  type CheckInFailureReason,
} from '@/lib/eventCheckIn';

const FAILURE_RESPONSES: Record<
  CheckInFailureReason,
  { status: number; message: string }
> = {
  NOT_FOUND: { status: 404, message: 'Registration not found.' },
  TRACKING_DISABLED: {
    status: 409,
    message: 'Attendance tracking is not enabled for this event.',
  },
  EVENT_ENDED: { status: 409, message: 'This event has ended.' },
  NOT_APPROVED: {
    status: 409,
    message: 'Only approved attendees can be checked in.',
  },
  ALREADY_CHECKED_IN: {
    status: 409,
    message: 'This attendee is already checked in.',
  },
};

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const search = new URL(req.url).searchParams.get('search');
    const result = await listEventCheckIns({
      eventId: params.eventId,
      actor: access.hacker!,
      search,
    });
    return NextResponse.json({
      trackAttendance: access.event!.trackAttendance,
      ...result,
    });
  } catch (error) {
    console.error('[EVENT_CHECK_INS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const body = await req.json().catch(() => null);
    const registrationId = body?.registrationId;
    if (typeof registrationId !== 'string' || !registrationId) {
      return badRequest('registrationId is required');
    }

    const result = await checkInEventRegistration({
      eventId: params.eventId,
      registrationId,
      actorId: access.hacker!.id,
    });

    if (!result.ok) {
      const failure = FAILURE_RESPONSES[result.reason];
      return NextResponse.json(
        {
          reason: result.reason,
          message: failure.message,
          checkedInAt: result.checkedInAt ?? null,
        },
        { status: failure.status }
      );
    }

    return NextResponse.json({
      registrationId: result.registration.id,
      checkedInAt: result.registration.checkedInAt,
      checkedInBy: access.hacker!.name,
    });
  } catch (error) {
    console.error('[EVENT_CHECK_INS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
