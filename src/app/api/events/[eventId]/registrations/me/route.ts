import { NextResponse } from 'next/server';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';
import { updatePendingPublicEventRegistration } from '@/lib/eventRegistrations';
import { publicRegistrationActionResponse } from '@/lib/publicRegistrationApi';

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

    return publicRegistrationActionResponse(result);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_ME_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
