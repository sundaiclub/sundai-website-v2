import { recordLinkClick, trackedRedirect } from '@/lib/linkClicks';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ code: string }> };

// Short per-recipient SMS links.
export async function GET(request: Request, props: Context) {
  const { code } = await props.params;
  return trackedRedirect(
    await recordLinkClick({ code }, request.headers.get('user-agent'))
  );
}

export async function HEAD(_request: Request, props: Context) {
  const { code } = await props.params;
  const shortLink = /^[0-9A-Za-z]{4,32}$/.test(code)
    ? await prisma.messageShortLink.findUnique({
        where: { code },
        select: { link: { select: { url: true } } },
      })
    : null;
  return trackedRedirect(shortLink?.link.url ?? null);
}
