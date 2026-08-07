import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import { revokeGlobalBan } from '@/lib/moderation';

export async function PATCH(
  req: Request,
  { params }: { params: { banId: string } }
) {
  try {
    const { hacker, response } = await requireSiteAdmin();
    if (response) return response;

    const body = await req.json().catch(() => ({}));
    const ban = await revokeGlobalBan({
      banId: params.banId,
      revokedById: hacker!.id,
      revocationReason: body?.revocationReason ?? null,
    });

    return NextResponse.json(ban);
  } catch (error) {
    console.error('[ADMIN_BAN_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
