import { recordLinkClick, trackedRedirect } from '@/lib/linkClicks';
import { isUuid } from '@/lib/messageRecipients';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ linkId: string }> };

export async function GET(request: Request, props: Context) {
  const { linkId } = await props.params;
  const recipientId = new URL(request.url).searchParams.get('r');
  return trackedRedirect(
    await recordLinkClick(
      { linkId, recipientId },
      request.headers.get('user-agent')
    )
  );
}

// Link scanners often send HEAD requests. They follow the link but do not count.
export async function HEAD(_request: Request, props: Context) {
  const { linkId } = await props.params;
  const link = isUuid(linkId)
    ? await prisma.messageLink.findUnique({
        where: { id: linkId },
        select: { url: true },
      })
    : null;
  return trackedRedirect(link?.url ?? null);
}
