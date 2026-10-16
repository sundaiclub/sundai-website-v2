import { NextResponse } from 'next/server';
import { resolveEventJudge } from '@/lib/judgingAccess';
import { JUDGE_TOKEN_HEADER } from '@/types/judging';
import { judgingErrorResponse, loadJudgePanel } from '@/lib/judgingData';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const judge = await resolveEventJudge(
      params.eventId,
      request.headers.get(JUDGE_TOKEN_HEADER)
    );
    if (!judge) {
      return NextResponse.json(
        { message: 'You are not a judge for this event.' },
        { status: 403 }
      );
    }
    const panel = await loadJudgePanel(params.eventId, judge.id);
    if (!panel) {
      return NextResponse.json(
        { message: 'Judging is not enabled for this event.' },
        { status: 404 }
      );
    }
    return NextResponse.json(panel);
  } catch (error) {
    return judgingErrorResponse(error, '[JUDGE_PANEL_GET]');
  }
}
