import prisma from '@/lib/prisma';
import {
  emptyTwimlResponse,
  verifyTwilioWebhook,
} from '@/lib/twilioWebhooks';

const TYPES = new Set(['STOP', 'HELP', 'START']);

function preferenceType(params: URLSearchParams) {
  const providerType = params.get('OptOutType')?.trim().toUpperCase();
  if (providerType && TYPES.has(providerType)) return providerType;

  const body = params.get('Body')?.trim().toUpperCase();
  return body && TYPES.has(body) ? body : null;
}

export async function POST(request: Request) {
  const verified = await verifyTwilioWebhook(request);
  if (!verified.ok) {
    return new Response(verified.message, { status: verified.status });
  }

  const type = preferenceType(verified.params);
  const providerSid = verified.params.get('MessageSid');
  const fromNumber = verified.params.get('From');
  if (!type || !providerSid || !fromNumber) return emptyTwimlResponse();

  const hackers = await prisma.hacker.findMany({
    where: { phoneNumber: fromNumber },
    select: { id: true },
  });
  const hackerIds = hackers.map(hacker => hacker.id);

  try {
    await prisma.$transaction(async tx => {
      await tx.smsPreferenceEvent.create({
        data: {
          providerSid,
          type: type as 'STOP' | 'HELP' | 'START',
          fromNumber,
          toNumber: verified.params.get('To'),
          hackerId: hackers.length === 1 ? hackers[0].id : null,
        },
      });

      if (type === 'STOP' && hackerIds.length > 0) {
        await tx.hacker.updateMany({
          where: { id: { in: hackerIds } },
          data: { smsConsentAt: null, smsConsentVersion: null },
        });
        await tx.chapterMembership.updateMany({
          where: { hackerId: { in: hackerIds } },
          data: {
            smsNotificationsEnabled: false,
            smsConsentAt: null,
            smsConsentVersion: null,
          },
        });
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') {
      console.error('[TWILIO_INCOMING_POST]', error);
      return new Response('Unable to process incoming message.', {
        status: 500,
      });
    }
  }

  // Advanced Opt-Out already sends the configured STOP or HELP response.
  return emptyTwimlResponse();
}
