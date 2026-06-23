import { NextResponse } from 'next/server';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';
import {
  updatePendingPublicEventRegistration,
  type PublicRegistrationActionResult,
} from '@/lib/eventRegistrations';

function publicRegistrationResponse(result: PublicRegistrationActionResult) {
  if (result.ok) {
    return NextResponse.json(result.registration);
  }

  if (result.reason === 'VALIDATION_FAILED') {
    return NextResponse.json(
      { message: 'Application answers are invalid.', issues: result.issues },
      { status: 400 }
    );
  }

  if (result.reason === 'REGISTRATION_NOT_FOUND') {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (result.reason === 'EDIT_NOT_ALLOWED' && result.registration) {
    return NextResponse.json(result.registration, { status: 409 });
  }

  return NextResponse.json({ message: result.reason }, { status: 400 });
}

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const body = await req.json();
    const result = await updatePendingPublicEventRegistration({
      eventId: params.eventId,
      hackerId: hacker.id,
      answersJson: body?.answersJson,
    });

    return publicRegistrationResponse(result);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_ME_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
