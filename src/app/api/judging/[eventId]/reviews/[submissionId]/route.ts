import { NextResponse } from 'next/server';
import { resolveEventJudge } from '@/lib/judgingAccess';
import { JUDGE_TOKEN_HEADER } from '@/types/judging';
import { judgingErrorResponse, saveJudgeReview } from '@/lib/judgingData';

export async function PUT(
  request: Request,
  { params }: { params: { eventId: string; submissionId: string } }
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
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json({ message: 'Invalid scores.' }, { status: 400 });
    }
    const review = await saveJudgeReview({
      eventId: params.eventId,
      judgeId: judge.id,
      submissionId: params.submissionId,
      scores: body.scores,
      comment: body.comment,
    });
    return NextResponse.json(review);
  } catch (error) {
    return judgingErrorResponse(error, '[JUDGE_REVIEW_PUT]');
  }
}
