import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import { sendJudgeInvite } from '@/lib/judgingAccess';
import { judgingErrorResponse, loadJudgingConfig } from '@/lib/judgingData';

export async function POST(
  request: Request,
  { params }: { params: { eventId: string; judgeId: string } }
) {
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;

    const judge = await prisma.eventJudge.findFirst({
      where: { id: params.judgeId, eventId: params.eventId, revokedAt: null },
      select: { id: true },
    });
    if (!judge) {
      return NextResponse.json(
        { message: 'Judge not found.' },
        { status: 404 }
      );
    }
    const delivery = await sendJudgeInvite(
      judge.id,
      new URL(request.url).origin
    );
    return NextResponse.json({
      config: await loadJudgingConfig(params.eventId),
      delivery,
    });
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGE_RESEND]');
  }
}
