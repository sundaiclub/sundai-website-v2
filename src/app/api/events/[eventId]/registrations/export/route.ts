import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  isSiteAdmin,
  requireEventAttendeeExportAccess,
} from '@/lib/eventManagementApi';
import {
  attendeeExportFilename,
  attendeeExportSelect,
  createAttendeeWorkbook,
} from '@/lib/eventAttendeeExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventAttendeeExportAccess(params.eventId);
    if (access.response) return access.response;
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: params.eventId,
        status: 'APPROVED',
        cancelledAt: null,
        ...(!isSiteAdmin(access.hacker!)
          ? { hacker: { userBans: { none: { revokedAt: null } } } }
          : {}),
      },
      select: attendeeExportSelect,
      orderBy: [{ hacker: { name: 'asc' } }, { id: 'asc' }],
    });
    const bytes = await createAttendeeWorkbook(access.event!, registrations);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${attendeeExportFilename(access.event!.slug)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[EVENT_ATTENDEES_EXPORT]', error);
    return NextResponse.json(
      { error: 'Could not download attendees.' },
      { status: 500 }
    );
  }
}
