import prisma from '@/lib/prisma';
import { publicUrl } from '@/lib/siteUrl';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// One recipient row of an event message or a weekly email.
export type RecipientRef = { kind: 'event' | 'weekly'; id: string };

export function recipientRefOf(message: {
  eventRecipientId?: string;
  weeklyRecipientId?: string;
}): RecipientRef | null {
  if (message.eventRecipientId)
    return { kind: 'event', id: message.eventRecipientId };
  if (message.weeklyRecipientId)
    return { kind: 'weekly', id: message.weeklyRecipientId };
  return null;
}

// Used in SES tags and unsubscribe links. Recipient IDs are random UUIDs.
export const recipientToken = (ref: RecipientRef) => `${ref.kind}-${ref.id}`;

export function parseRecipientToken(value: unknown): RecipientRef | null {
  if (typeof value !== 'string') return null;
  const match = /^(event|weekly)-(.+)$/.exec(value);
  if (!match || !isUuid(match[2])) return null;
  return { kind: match[1] as RecipientRef['kind'], id: match[2] };
}

export const unsubscribeUrl = (ref: RecipientRef) =>
  publicUrl(`/api/email/unsubscribe/${recipientToken(ref)}`);

// RFC 8058 one-click unsubscribe headers for bulk email.
export function listUnsubscribeHeaders(ref: RecipientRef) {
  return [
    { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl(ref)}>` },
    { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
  ];
}

// Turns off chapter email for the person who received this message. An event
// message covers its chapter. The weekly email covers all of their chapters.
export async function disableRecipientEmail(
  ref: RecipientRef,
  reason: 'UNSUBSCRIBE' | 'COMPLAINT',
  db = prisma
) {
  const now = new Date();
  let hackerId: string;
  let event: { chapterId: string; chapter: { slug: string } } | null = null;
  if (ref.kind === 'event') {
    const row = await db.eventCommunicationRecipient.findUnique({
      where: { id: ref.id },
      select: {
        hackerId: true,
        communication: {
          select: {
            event: {
              select: { chapterId: true, chapter: { select: { slug: true } } },
            },
          },
        },
      },
    });
    if (!row) return null;
    hackerId = row.hackerId;
    event = row.communication.event;
  } else {
    const row = await db.weeklyEmailRecipient.findUnique({
      where: { id: ref.id },
      select: { hackerId: true },
    });
    if (!row) return null;
    hackerId = row.hackerId;
  }
  await db.$transaction(async tx => {
    await tx.chapterMembership.updateMany({
      where: {
        hackerId,
        ...(event ? { chapterId: event.chapterId } : {}),
      },
      data: { emailNotificationsEnabled: false },
    });
    if (reason === 'UNSUBSCRIBE') {
      const where = { id: ref.id, unsubscribedAt: null };
      const data = { unsubscribedAt: now };
      if (ref.kind === 'event')
        await tx.eventCommunicationRecipient.updateMany({ where, data });
      else await tx.weeklyEmailRecipient.updateMany({ where, data });
    }
  });
  return { chapterSlug: event?.chapter.slug ?? null };
}
