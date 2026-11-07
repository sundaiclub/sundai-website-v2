import { NextResponse } from 'next/server';
import { resolveEventJudge } from '@/lib/judgingAccess';
import { JUDGE_TOKEN_HEADER } from '@/types/judging';
import { judgingErrorResponse, recordJudgeViewing } from '@/lib/judgingData';

/** The judging page reports the project it has open so it is never moved. */
export async function PUT(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
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
    const body = (await request.json().catch(() => null)) as {
      submissionId?: unknown;
    } | null;
    if (typeof body?.submissionId !== 'string' || !body.submissionId) {
      return NextResponse.json(
        { message: 'Invalid project.' },
        { status: 400 }
      );
    }
    await recordJudgeViewing(params.eventId, judge.id, body.submissionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return judgingErrorResponse(error, '[JUDGE_VIEWING_PUT]');
  }
}
