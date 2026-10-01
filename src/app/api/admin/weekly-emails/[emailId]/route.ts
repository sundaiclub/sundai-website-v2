import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { getEventDeliveryAvailability } from '@/lib/eventDelivery';
import {
  buildWeeklyEmails,
  loadWeeklyEmailContent,
  parseWeeklyEmailDraft,
} from '@/lib/weeklyEmails';
import { createEmailBatches, publishEmailBatches } from '@/lib/emailQueue';

export const runtime = 'nodejs';
type Context = { params: { emailId: string } };

export async function GET(request: Request, { params }: Context) {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const ids = new URL(request.url).searchParams.get('batches')?.split(',');
  const where = ids ? { id: { in: ids } } : { weeklyEmailId: params.emailId };
  const [totals, pending] = await Promise.all([
    prisma.emailDeliveryBatch.aggregate({
      where,
      _sum: { sentCount: true, failedCount: true },
    }),
    prisma.emailDeliveryBatch.count({
      where: { ...where, status: { not: 'COMPLETED' } },
    }),
  ]);
  return NextResponse.json({
    sent: totals._sum.sentCount ?? 0,
    failed: totals._sum.failedCount ?? 0,
    pending,
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const draft = parseWeeklyEmailDraft(await request.json().catch(() => null));
  if (!draft)
    return NextResponse.json(
      {
        message:
          'Invalid draft. The subject limit is 200 characters and the message limit is 50,000 characters.',
      },
      { status: 400 }
    );
  const result = await prisma.weeklyEmail.updateMany({
    where: { id: params.emailId, status: 'DRAFT' },
    data: draft,
  });
  if (!result.count)
    return NextResponse.json(
      { message: 'This draft is no longer available.' },
      { status: 409 }
    );
  return NextResponse.json({ id: params.emailId, ...draft });
}

export async function POST(request: Request, { params }: Context) {
  const { hacker, response } = await requireSiteAdmin();
  if (response) return response;
  const input = await request.json().catch(() => null);
  if (input?.action !== 'test' && input?.action !== 'send')
    return NextResponse.json(
      { message: 'Choose test or send.' },
      { status: 400 }
    );
  if (!getEventDeliveryAvailability().email)
    return NextResponse.json(
      { message: 'Email sending is not configured.' },
      { status: 503 }
    );
  const draft = await prisma.weeklyEmail.findUnique({
    where: { id: params.emailId },
  });
  if (draft?.status === 'SENDING' && input.action === 'send') {
    const batches = await prisma.emailDeliveryBatch.findMany({
      where: { weeklyEmailId: draft.id, status: 'QUEUED' },
      select: { id: true },
    });
    await publishEmailBatches(batches.map(batch => batch.id));
    return NextResponse.json({ queued: true, test: false }, { status: 202 });
  }
  if (!draft || draft.status !== 'DRAFT')
    return NextResponse.json(
      { message: 'This draft is no longer available for sending.' },
      { status: 409 }
    );
  if (!draft.subject.trim() || !draft.body.trim())
    return NextResponse.json(
      { message: 'Enter a subject and message before sending.' },
      { status: 400 }
    );
  const test = input.action === 'test';
  if (test && !hacker!.email?.trim())
    return NextResponse.json(
      { message: 'Your account needs an email address for a test.' },
      { status: 400 }
    );
  const content = await loadWeeklyEmailContent(
    new Date(),
    test ? hacker!.id : undefined
  );
  if (!content.recipients.length)
    return NextResponse.json(
      { message: 'No eligible email recipients were found.' },
      { status: 400 }
    );
  const messages = buildWeeklyEmails(
    { ...draft, subject: test ? `[Test] ${draft.subject}` : draft.subject },
    content
  );
  const batchIds = await prisma.$transaction(async tx => {
    if (!test) {
      const claimed = await tx.weeklyEmail.updateMany({
        where: { id: draft.id, status: 'DRAFT', updatedAt: draft.updatedAt },
        data: { status: 'SENDING' },
      });
      if (!claimed.count) return null;
    }
    return createEmailBatches(
      tx,
      messages,
      test ? {} : { weeklyEmailId: draft.id }
    );
  });
  if (!batchIds)
    return NextResponse.json(
      {
        message:
          'This draft changed or is already being sent. Reload the page.',
      },
      { status: 409 }
    );
  let warning: string | undefined;
  try {
    await publishEmailBatches(batchIds);
  } catch {
    warning =
      'Some saved emails could not be queued. Use Resume queued emails to continue.';
  }
  return NextResponse.json(
    { queued: messages.length, test, batchIds, warning },
    { status: 202 }
  );
}
