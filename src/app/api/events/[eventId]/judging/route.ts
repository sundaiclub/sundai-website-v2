import { NextResponse } from 'next/server';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import {
  judgingErrorResponse,
  loadJudgingConfig,
  saveJudgingConfig,
} from '@/lib/judgingData';
import type { JudgingConfigInput } from '@/types/judging';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;
    return NextResponse.json(await loadJudgingConfig(params.eventId));
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGING_GET]');
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;

    const body = (await request
      .json()
      .catch(() => null)) as JudgingConfigInput | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { message: 'Invalid judging setup.' },
        { status: 400 }
      );
    }
    await saveJudgingConfig(params.eventId, body);
    return NextResponse.json(await loadJudgingConfig(params.eventId));
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGING_PUT]');
  }
}
