import { NextResponse } from 'next/server';
import { requireEventJudgingManager } from '@/lib/eventManagementApi';
import { judgingErrorResponse } from '@/lib/judgingData';
import {
  createJudgingWorkbook,
  judgingExportFilename,
  loadJudgingExport,
} from '@/lib/judgingExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await props.params;
  try {
    const access = await requireEventJudgingManager(eventId);
    if (access.response) return access.response;
    const data = await loadJudgingExport(eventId);
    const bytes = await createJudgingWorkbook(data);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${judgingExportFilename(data.event.slug)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return judgingErrorResponse(error, '[EVENT_JUDGING_EXPORT]');
  }
}
