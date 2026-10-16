import { NextResponse } from 'next/server';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import { sendJudgeInvite } from '@/lib/judgingAccess';
import {
  judgingErrorResponse,
  loadJudgingConfig,
  upsertEventJudge,
} from '@/lib/judgingData';

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json(
        { message: 'Invalid judge invite.' },
        { status: 400 }
      );
    }
    const judgeId = await upsertEventJudge({
      eventId: params.eventId,
      actorId: access.hacker!.id,
      hackerId: body.hackerId,
      email: body.email,
      name: body.name,
      trackIds: body.trackIds,
    });
    const delivery = await sendJudgeInvite(
      judgeId,
      new URL(request.url).origin
    );
    return NextResponse.json(
      { config: await loadJudgingConfig(params.eventId), delivery },
      { status: 201 }
    );
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGES_POST]');
  }
}
