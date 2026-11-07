import type { EventCommunicationRecipientStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  disableRecipientEmail,
  parseRecipientToken,
  recipientRefOf,
  recipientToken,
  type RecipientRef,
} from '@/lib/messageRecipients';

// The recipient row ID is sent as an SES message tag so delivery events match
// even when they arrive before the queue worker saves the SES message ID.
export const SES_RECIPIENT_TAG = 'sundai_recipient';

export function sesRecipientTags(message: {
  eventRecipientId?: string;
  weeklyRecipientId?: string;
}) {
  const ref = recipientRefOf(message);
  return ref ? { [SES_RECIPIENT_TAG]: recipientToken(ref) } : undefined;
}

export type SesEvent = {
  eventType?: string;
  notificationType?: string;
  mail?: { messageId?: string; tags?: Record<string, string[] | undefined> };
  delivery?: { timestamp?: string };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    timestamp?: string;
    bouncedRecipients?: Array<{ diagnosticCode?: string }>;
  };
  complaint?: { timestamp?: string };
  reject?: { reason?: string };
  failure?: { errorMessage?: string };
};

type RecipientUpdate = {
  status?: EventCommunicationRecipientStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  deliveredAt?: Date | null;
  complainedAt?: Date;
};

const FINAL_FAILURES: EventCommunicationRecipientStatus[] = [
  'UNDELIVERED',
  'FAILED',
];

function eventDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const codePart = (value: string | undefined) =>
  (value || 'Undetermined').replace(/[^A-Za-z0-9]/g, '');

function sesEventUpdate(event: SesEvent): {
  data: RecipientUpdate;
  unlessFailed?: boolean;
} | null {
  switch (event.eventType ?? event.notificationType) {
    case 'Delivery':
      return {
        data: {
          status: 'DELIVERED',
          deliveredAt: eventDate(event.delivery?.timestamp),
        },
        // A Delivery event never replaces an earlier bounce or rejection.
        unlessFailed: true,
      };
    case 'Bounce':
      return {
        data: {
          status: 'UNDELIVERED',
          errorCode: `Bounce.${codePart(event.bounce?.bounceType)}.${codePart(event.bounce?.bounceSubType)}`,
          errorMessage:
            event.bounce?.bouncedRecipients?.[0]?.diagnosticCode?.slice(
              0,
              1000
            ) ?? null,
          deliveredAt: null,
        },
      };
    case 'Complaint':
      return {
        data: { complainedAt: eventDate(event.complaint?.timestamp) },
      };
    case 'Reject':
      return {
        data: {
          status: 'FAILED',
          errorCode: 'Reject',
          errorMessage: event.reject?.reason?.slice(0, 1000) ?? null,
        },
      };
    case 'Rendering Failure':
      return {
        data: {
          status: 'FAILED',
          errorCode: 'RenderingFailure',
          errorMessage: event.failure?.errorMessage?.slice(0, 1000) ?? null,
        },
      };
    default:
      return null;
  }
}

async function findRecipient(
  event: SesEvent,
  db: typeof prisma
): Promise<RecipientRef | null> {
  const tagged = parseRecipientToken(
    event.mail?.tags?.[SES_RECIPIENT_TAG]?.[0]
  );
  if (tagged) return tagged;
  const providerMessageId = event.mail?.messageId;
  if (!providerMessageId) return null;
  const eventRecipient = await db.eventCommunicationRecipient.findFirst({
    where: { providerMessageId },
    select: { id: true },
  });
  if (eventRecipient) return { kind: 'event', id: eventRecipient.id };
  const weeklyRecipient = await db.weeklyEmailRecipient.findFirst({
    where: { providerMessageId },
    select: { id: true },
  });
  return weeklyRecipient ? { kind: 'weekly', id: weeklyRecipient.id } : null;
}

export async function applySesEvent(event: SesEvent, db = prisma) {
  const update = sesEventUpdate(event);
  if (!update) return { matched: false };
  const recipient = await findRecipient(event, db);
  if (!recipient) return { matched: false };
  const where = {
    id: recipient.id,
    ...(update.unlessFailed ? { status: { notIn: FINAL_FAILURES } } : {}),
  };
  const result =
    recipient.kind === 'event'
      ? await db.eventCommunicationRecipient.updateMany({
          where,
          data: update.data,
        })
      : await db.weeklyEmailRecipient.updateMany({
          where,
          data: update.data,
        });
  // A spam complaint turns off chapter email for that person.
  if (update.data.complainedAt && result.count)
    await disableRecipientEmail(recipient, 'COMPLAINT', db);
  return { matched: result.count > 0 };
}
