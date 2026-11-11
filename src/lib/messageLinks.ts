import { randomBytes } from 'crypto';
import type { MessageLinkKind, Prisma } from '@prisma/client';
import { PUBLIC_APP_URL, publicUrl } from '@/lib/siteUrl';

export type MessageLinkSource = {
  eventCommunicationId?: string;
  weeklyEmailId?: string;
};

const HREF_PATTERN = /href="([^"]*)"/g;
// A bare URL in message text. Trailing punctuation is not part of the link.
const TEXT_URL_PATTERN = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]']/g;
const SHORT_CODE_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_CODE_LENGTH = 8;

const siteHost = new URL(PUBLIC_APP_URL).hostname.replace(/^www\./, '');

const decodeAttribute = (value: string) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const encodeAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function parseHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function messageLinkKind(url: string): MessageLinkKind {
  const parsed = parseHttpUrl(url);
  return parsed &&
    (parsed.searchParams.get('tab') === 'preferences' ||
      parsed.hash === '#notification-preferences' ||
      parsed.pathname.includes('/unsubscribe'))
    ? 'PREFERENCES'
    : 'CONTENT';
}

// The chapter and event slugs of a link to one of our event pages.
function eventPagePath(url: string) {
  const parsed = parseHttpUrl(url);
  if (!parsed || parsed.hostname.replace(/^www\./, '') !== siteHost)
    return null;
  const match = /^\/events\/([^/]+)\/([^/]+)\/?$/.exec(parsed.pathname);
  if (!match) return null;
  try {
    return {
      chapterSlug: decodeURIComponent(match[1]),
      eventSlug: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

export function trackableHtmlUrls(html: string) {
  const urls = new Set<string>();
  for (const [, raw] of html.matchAll(HREF_PATTERN)) {
    const url = decodeAttribute(raw);
    if (parseHttpUrl(url)) urls.add(url);
  }
  return [...urls];
}

export const emailLinkRedirectUrl = (linkId: string, recipientId: string) =>
  publicUrl(
    `/l/${encodeURIComponent(linkId)}?r=${encodeURIComponent(recipientId)}`
  );

export function rewriteEmailLinks(
  html: string,
  linkIds: Map<string, string>,
  recipientId: string
) {
  return html.replace(HREF_PATTERN, (match, raw: string) => {
    const linkId = linkIds.get(decodeAttribute(raw));
    return linkId
      ? `href="${encodeAttribute(emailLinkRedirectUrl(linkId, recipientId))}"`
      : match;
  });
}

// Stores one row per distinct destination of a send and returns their IDs.
export async function registerMessageLinks(
  db: Prisma.TransactionClient,
  urls: string[],
  source: MessageLinkSource
) {
  const linkIds = new Map<string, string>();
  if (!urls.length) return linkIds;
  const owner = source.eventCommunicationId
    ? { eventCommunicationId: source.eventCommunicationId }
    : { weeklyEmailId: source.weeklyEmailId };
  const paths = urls.flatMap(url => {
    const path = eventPagePath(url);
    return path ? [{ url, ...path }] : [];
  });
  const events = paths.length
    ? await db.event.findMany({
        where: {
          OR: paths.map(path => ({
            slug: path.eventSlug,
            chapter: { slug: path.chapterSlug },
          })),
        },
        select: { id: true, slug: true, chapter: { select: { slug: true } } },
      })
    : [];
  const eventIdByUrl = new Map(
    paths.flatMap(path => {
      const event = events.find(
        item =>
          item.slug === path.eventSlug && item.chapter.slug === path.chapterSlug
      );
      return event ? [[path.url, event.id] as const] : [];
    })
  );
  await db.messageLink.createMany({
    data: urls.map(url => ({
      ...owner,
      url,
      kind: messageLinkKind(url),
      eventId: eventIdByUrl.get(url) ?? null,
    })),
    skipDuplicates: true,
  });
  const links = await db.messageLink.findMany({
    where: { ...owner, url: { in: urls } },
    select: { id: true, url: true },
  });
  for (const link of links) linkIds.set(link.url, link.id);
  return linkIds;
}

function shortCode() {
  return [...randomBytes(SHORT_CODE_LENGTH)]
    .map(byte => SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length])
    .join('');
}

// Replaces each URL in an SMS with a short per-recipient link, /s/<code>.
// Returns the message body for each recipient ID.
export async function shortenSmsLinks(
  db: Prisma.TransactionClient,
  communicationId: string,
  body: string,
  recipientIds: string[]
) {
  const urls = [...new Set(body.match(TEXT_URL_PATTERN) ?? [])];
  if (!urls.length) return new Map(recipientIds.map(id => [id, body] as const));
  const linkIds = await registerMessageLinks(db, urls, {
    eventCommunicationId: communicationId,
  });
  const bodies = new Map<string, string>();
  const rows: Array<{
    code: string;
    linkId: string;
    eventRecipientId: string;
  }> = [];
  for (const recipientId of recipientIds) {
    const codes = new Map<string, string>();
    for (const url of urls) {
      const code = shortCode();
      codes.set(url, code);
      rows.push({
        code,
        linkId: linkIds.get(url)!,
        eventRecipientId: recipientId,
      });
    }
    bodies.set(
      recipientId,
      body.replace(TEXT_URL_PATTERN, url =>
        codes.has(url) ? publicUrl(`/s/${codes.get(url)}`) : url
      )
    );
  }
  for (let offset = 0; offset < rows.length; offset += 1000) {
    await db.messageShortLink.createMany({
      data: rows.slice(offset, offset + 1000),
    });
  }
  return bodies;
}
