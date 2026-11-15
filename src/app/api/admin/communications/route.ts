import { NextResponse } from 'next/server';
import { loadAdminCommunicationGroups } from '@/lib/adminCommunications';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import { loadMessagingHealth } from '@/lib/messagingHealth';
import { parsePageNumber } from '@/lib/pagination';
import prisma from '@/lib/prisma';

const PAGE_SIZE = 50;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const page =
      parsePageNumber(new URL(request.url).searchParams.get('page')) ?? 1;
    const where = { sentAt: { not: null } };
    const [allGroups, groupPage, health] = await Promise.all([
      prisma.eventCommunication.groupBy({
        by: ['eventId', 'sendGroupId'],
        where,
      }),
      prisma.eventCommunication.groupBy({
        by: ['eventId', 'sendGroupId'],
        where,
        _max: { sentAt: true },
        orderBy: { _max: { sentAt: 'desc' } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      loadMessagingHealth(),
    ]);

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total: allGroups.length,
      health,
      items: await loadAdminCommunicationGroups(where, groupPage),
    });
  } catch (error) {
    console.error('[ADMIN_COMMUNICATIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
