import { NextResponse } from 'next/server';
import { communicationStats, fiveWordExcerpt } from '@/lib/adminCommunications';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';

const PAGE_SIZE = 50;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const requestedPage = Number(new URL(request.url).searchParams.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const where = { sentAt: { not: null } };
    const [total, communications] = await Promise.all([
      prisma.eventCommunication.count({ where }),
      prisma.eventCommunication.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          channel: true,
          status: true,
          subject: true,
          body: true,
          sentAt: true,
          event: {
            select: {
              id: true,
              title: true,
              chapter: { select: { id: true, name: true, slug: true } },
            },
          },
          sentBy: { select: { id: true, name: true, email: true } },
          recipients: { select: { status: true } },
        },
      }),
    ]);

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total,
      items: communications.map(item => ({
        id: item.id,
        channel: item.channel,
        status: item.status,
        subject: item.subject,
        excerpt: fiveWordExcerpt(item.body),
        sentAt: item.sentAt!.toISOString(),
        chapter: item.event.chapter,
        event: { id: item.event.id, title: item.event.title },
        sentBy: item.sentBy,
        stats: communicationStats(item.recipients.map(row => row.status)),
      })),
    });
  } catch (error) {
    console.error('[ADMIN_COMMUNICATIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
