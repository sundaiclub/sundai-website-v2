import {
  disableRecipientEmail,
  parseRecipientToken,
} from '@/lib/messageRecipients';
import prisma from '@/lib/prisma';
import { publicUrl } from '@/lib/siteUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ token: string }> };

// RFC 8058 one-click unsubscribe. Mail providers POST here from the
// List-Unsubscribe header. The token is the recipient row ID from one email.
export async function POST(_request: Request, props: Context) {
  const ref = parseRecipientToken((await props.params).token);
  if (!ref) return new Response('Invalid unsubscribe link.', { status: 404 });
  const result = await disableRecipientEmail(ref, 'UNSUBSCRIBE');
  if (!result)
    return new Response('Invalid unsubscribe link.', { status: 404 });
  return new Response('You are unsubscribed from these emails.', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

// A GET can come from a link scanner, so it never unsubscribes. It opens the
// notification preferences instead.
export async function GET(_request: Request, props: Context) {
  const ref = parseRecipientToken((await props.params).token);
  const recipient =
    ref?.kind === 'event'
      ? await prisma.eventCommunicationRecipient.findUnique({
          where: { id: ref.id },
          select: {
            communication: {
              select: {
                event: { select: { chapter: { select: { slug: true } } } },
              },
            },
          },
        })
      : null;
  const slug = recipient?.communication.event.chapter.slug;
  return new Response(null, {
    status: 302,
    headers: {
      location: publicUrl(
        slug
          ? `/chapters/${encodeURIComponent(slug)}?tab=preferences#notification-preferences`
          : '/chapters'
      ),
      'cache-control': 'private, no-store',
    },
  });
}
