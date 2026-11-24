import { NextResponse } from 'next/server';
import { loadEventEngagementReport } from '@/lib/eventEngagement';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import { privateJson } from '@/lib/publicData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    return privateJson(await loadEventEngagementReport());
  } catch (error) {
    console.error('[ADMIN_EVENT_ENGAGEMENT_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
