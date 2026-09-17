import { NextResponse } from 'next/server';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';
import { parseWeeklyEmailDraft } from '@/lib/weeklyEmails';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { response } = await requireSiteAdmin();
  if (response) return response;
  const drafts = await prisma.weeklyEmail.findMany({
    where: { status: 'DRAFT' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  return NextResponse.json({ drafts });
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
