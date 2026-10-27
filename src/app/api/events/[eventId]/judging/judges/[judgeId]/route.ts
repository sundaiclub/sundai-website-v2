import { NextResponse } from 'next/server';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import {
  judgingErrorResponse,
  loadJudgingConfig,
  revokeEventJudge,
  updateEventJudge,
} from '@/lib/judgingData';

type JudgeRouteContext = { params: Promise<{ eventId: string; judgeId: string }> };

export async function PATCH(request: Request, props: JudgeRouteContext) {
  const params = await props.params;
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json(
        { message: 'Invalid judge update.' },
        { status: 400 }
      );
    }
    await updateEventJudge({
      eventId: params.eventId,
      judgeId: params.judgeId,
      name: body.name,
      trackIds: body.trackIds,
    });
    return NextResponse.json(await loadJudgingConfig(params.eventId));
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGE_PATCH]');
  }
}

export async function DELETE(_request: Request, props: JudgeRouteContext) {
  const params = await props.params;
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;
    await revokeEventJudge(params.eventId, params.judgeId);
    return NextResponse.json(await loadJudgingConfig(params.eventId));
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGE_DELETE]');
  }
}
