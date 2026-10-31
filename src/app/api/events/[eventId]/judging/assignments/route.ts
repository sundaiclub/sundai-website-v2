import { NextResponse } from 'next/server';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import {
  judgingErrorResponse,
  loadJudgingAssignments,
} from '@/lib/judgingData';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventJudgingManager(params.eventId);
    if (access.response) return access.response;
    return NextResponse.json(await loadJudgingAssignments(params.eventId));
  } catch (error) {
    return judgingErrorResponse(error, '[JUDGING_ASSIGNMENTS_GET]');
  }
}
