import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { parseWeeklyEmailDraft } from '@/lib/weeklyEmails';
import { weeklyEmailDeliveryStats } from '@/lib/deliveryStats';

const SENT_HISTORY_SIZE = 20;

export const dynamic = 'force-dynamic';

export async function GET() {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const [drafts, sent] = await Promise.all([
    prisma.weeklyEmail.findMany({
      where: { status: 'DRAFT' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    }),
    prisma.weeklyEmail.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: [{ sentAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: SENT_HISTORY_SIZE,
      select: { id: true, subject: true, status: true, sentAt: true },
    }),
  ]);
  const stats = await weeklyEmailDeliveryStats(sent.map(email => email.id));
  return NextResponse.json({
    drafts,
    sent: sent.map(email => ({
      ...email,
      sentAt: email.sentAt?.toISOString() ?? null,
      stats: stats.get(email.id),
    })),
  });
}

export async function POST(request: Request) {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const draft = parseWeeklyEmailDraft(await request.json().catch(() => null));
  if (!draft)
    return NextResponse.json(
      {
        message:
          'Use a subject of up to 200 characters and a message of up to 50,000 characters.',
      },
      { status: 400 }
    );
  return NextResponse.json(await prisma.weeklyEmail.create({ data: draft }), {
    status: 201,
  });
}
