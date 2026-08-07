import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import { resolveBanFlag } from '@/lib/moderation';

export async function PATCH(
  req: Request,
  { params }: { params: { flagId: string } }
) {
  try {
    const { hacker, response } = await requireSiteAdmin();
    if (response) return response;

    const body = await req.json();
    const flag = await resolveBanFlag({
      flagId: params.flagId,
      resolvedById: hacker!.id,
      status: body?.status ?? 'RESOLVED_NO_ACTION',
      resolutionNote: body?.resolutionNote ?? null,
    });

    return NextResponse.json(flag);
  } catch (error) {
    console.error('[ADMIN_BAN_FLAG_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
