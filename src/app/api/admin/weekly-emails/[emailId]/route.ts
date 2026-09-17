import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { getEventDeliveryAvailability } from '@/lib/eventDelivery';
import {
  deliverWeeklyEmail,
  loadWeeklyEmailContent,
  parseWeeklyEmailDraft,
} from '@/lib/weeklyEmails';

export const runtime = 'nodejs';
export const maxDuration = 300;
type Context = { params: { emailId: string } };

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
  if (!test) {
    const claimed = await prisma.weeklyEmail.updateMany({
      where: { id: draft.id, status: 'DRAFT', updatedAt: draft.updatedAt },
      data: { status: 'SENDING' },
    });
    if (!claimed.count)
      return NextResponse.json(
        {
          message:
            'This draft changed or is already being sent. Reload the page.',
        },
        { status: 409 }
      );
  }
  const result = await deliverWeeklyEmail(
    { ...draft, subject: test ? `[Test] ${draft.subject}` : draft.subject },
    content
  );
  if (!test)
    await prisma.weeklyEmail.update({
      where: { id: draft.id },
      data: { status: 'SENT' },
    });
  return NextResponse.json({ ...result, test });
}
