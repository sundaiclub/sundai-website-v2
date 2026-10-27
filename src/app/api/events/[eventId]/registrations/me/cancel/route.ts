import { NextResponse } from 'next/server';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';
import { cancelPublicEventRegistration } from '@/lib/eventRegistrations';
import { publicRegistrationActionResponse } from '@/lib/publicRegistrationApi';

export async function POST(
  _req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const result = await cancelPublicEventRegistration({
      eventId: params.eventId,
      hackerId: hacker.id,
      cancelledById: hacker.id,
    });

    return publicRegistrationActionResponse(result);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_ME_CANCEL_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
