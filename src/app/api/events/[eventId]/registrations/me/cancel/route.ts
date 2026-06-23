import { NextResponse } from 'next/server';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';
import {
  cancelPublicEventRegistration,
  type PublicRegistrationActionResult,
} from '@/lib/eventRegistrations';

function publicRegistrationResponse(result: PublicRegistrationActionResult) {
  if (result.ok) {
    return NextResponse.json(result.registration);
  }

  if (result.reason === 'REGISTRATION_NOT_FOUND') {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (result.reason === 'CANCEL_NOT_ALLOWED' && result.registration) {
    return NextResponse.json(result.registration, { status: 409 });
  }

  return NextResponse.json({ message: result.reason }, { status: 400 });
}

export async function POST(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const result = await cancelPublicEventRegistration({
      eventId: params.eventId,
      hackerId: hacker.id,
      cancelledById: hacker.id,
    });

    return publicRegistrationResponse(result);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_ME_CANCEL_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
