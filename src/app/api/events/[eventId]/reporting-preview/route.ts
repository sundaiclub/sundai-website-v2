import { NextResponse } from 'next/server';
import {
  isSiteAdmin,
  requireEventWorkspaceAccess,
} from '@/lib/eventManagementApi';
import { getEventReportingPreview } from '@/lib/eventReportingPreview';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const preview = await getEventReportingPreview(
      params.eventId,
      isSiteAdmin(access.hacker)
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error('[EVENT_REPORTING_PREVIEW_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
