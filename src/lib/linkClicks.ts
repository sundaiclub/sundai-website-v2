import prisma from '@/lib/prisma';
import { isUuid } from '@/lib/messageRecipients';
import { publicUrl } from '@/lib/siteUrl';

// Mail security scanners, chat link previews (including iMessage, which uses
// the facebookexternalhit agent), and scripts. Their clicks are excluded.
const BOT_USER_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|preview|scanner|facebookexternalhit|whatsapp|telegram|discord|skype|curl\/|wget\/|python-requests|go-http-client|okhttp|java\/|headless|phantomjs|barracuda|proofpoint|mimecast|safelinks|microsoft office|google-safety|virustotal/i;
// Scanners open links as soon as the email arrives.
export const TOO_FAST_MS = 10_000;
// Scanners open every link in a message at once. A person does not.
export const BURST_MS = 2_000;

export function classifyLinkClick({
  userAgent,
  channel,
  sentAt,
  clickedAt,
}: {
  userAgent: string | null;
  channel: 'EMAIL' | 'SMS';
  sentAt: Date | null;
  clickedAt: Date;
}) {
  if (!userAgent?.trim() || BOT_USER_AGENT.test(userAgent)) return 'USER_AGENT';
  if (
    channel === 'EMAIL' &&
    sentAt &&
    clickedAt.getTime() - sentAt.getTime() < TOO_FAST_MS
  )
    return 'TOO_FAST';
  return null;
}

const linkSelect = {
  id: true,
  url: true,
  eventCommunicationId: true,
  weeklyEmailId: true,
  eventCommunication: { select: { channel: true } },
} as const;

type LinkTarget = { linkId: string; recipientId: string | null };

async function findTarget(
  target: { linkId: string; recipientId: string | null } | { code: string },
  db: typeof prisma
) {
  if ('code' in target) {
    if (!/^[0-9A-Za-z]{4,32}$/.test(target.code)) return null;
    const shortLink = await db.messageShortLink.findUnique({
      where: { code: target.code },
      select: { eventRecipientId: true, link: { select: linkSelect } },
    });
    return shortLink
      ? { link: shortLink.link, recipientId: shortLink.eventRecipientId }
      : null;
  }
  if (!isUuid(target.linkId)) return null;
  const link = await db.messageLink.findUnique({
    where: { id: target.linkId },
    select: linkSelect,
  });
  return link ? { link, recipientId: target.recipientId } : null;
}

// Saves one click and returns the stored destination. Only stored URLs are
// redirect targets, so the routes cannot be used as an open redirect.
export async function recordLinkClick(
  target: LinkTarget | { code: string },
  userAgent: string | null,
  db = prisma
) {
  const found = await findTarget(target, db);
  if (!found) return null;
  const { link } = found;
  const channel = link.eventCommunication?.channel ?? 'EMAIL';

  try {
    await db.$transaction(async tx => {
      const clickedAt = new Date();
      let recipient:
        | { eventRecipientId: string; sentAt: Date | null }
        | { weeklyRecipientId: string; sentAt: Date | null }
        | null = null;
      if (isUuid(found.recipientId)) {
        if (link.eventCommunicationId) {
          const row = await tx.eventCommunicationRecipient.findFirst({
            where: {
              id: found.recipientId,
              communicationId: link.eventCommunicationId,
            },
            select: { id: true, attemptedAt: true },
          });
          if (row)
            recipient = { eventRecipientId: row.id, sentAt: row.attemptedAt };
        } else if (link.weeklyEmailId) {
          const row = await tx.weeklyEmailRecipient.findFirst({
            where: { id: found.recipientId, weeklyEmailId: link.weeklyEmailId },
            select: { id: true, attemptedAt: true },
          });
          if (row)
            recipient = { weeklyRecipientId: row.id, sentAt: row.attemptedAt };
        }
      }
      const recipientWhere = recipient
        ? 'eventRecipientId' in recipient
          ? { eventRecipientId: recipient.eventRecipientId }
          : { weeklyRecipientId: recipient.weeklyRecipientId }
        : {};
      let botReason = classifyLinkClick({
        userAgent,
        channel,
        sentAt: recipient?.sentAt ?? null,
        clickedAt,
      });
      if (!botReason && recipient) {
        // Another link opened by the same recipient a moment ago means a
        // scanner is opening every link. Exclude all of those clicks.
        const burst = await tx.messageLinkClick.updateMany({
          where: {
            ...recipientWhere,
            isBot: false,
            linkId: { not: link.id },
            clickedAt: { gte: new Date(clickedAt.getTime() - BURST_MS) },
          },
          data: { isBot: true, botReason: 'BURST' },
        });
        if (burst.count) botReason = 'BURST';
      }
      await tx.messageLinkClick.create({
        data: {
          linkId: link.id,
          clickedAt,
          isBot: Boolean(botReason),
          botReason,
          ...recipientWhere,
        },
      });
    });
  } catch (error) {
    // A failed count never stops the reader from reaching the link.
    console.error('[MESSAGE_LINK_CLICK]', error);
  }
  return link.url;
}

export const trackedRedirect = (url: string | null) =>
  new Response(null, {
    status: 302,
    headers: {
      location: url ?? publicUrl('/'),
      'cache-control': 'private, no-store',
    },
  });
