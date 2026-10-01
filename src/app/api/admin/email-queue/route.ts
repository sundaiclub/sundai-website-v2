import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { publishEmailBatches } from '@/lib/emailQueue';

export const runtime = 'nodejs';

export async function POST() {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const batches = await prisma.emailDeliveryBatch.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: 500,
    select: { id: true },
  });
  try {
    await publishEmailBatches(batches.map(batch => batch.id));
    return NextResponse.json({ queuedBatches: batches.length });
  } catch {
    return NextResponse.json(
      {
        message:
          'The email queue is unavailable. Saved emails remain pending. Try to resume them later.',
      },
      { status: 503 }
    );
  }
}
