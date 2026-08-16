import { NextResponse } from 'next/server';
import { requireEventWorkspaceAccess } from '@/lib/eventManagementApi';
import { listEventWorkspaceProjects } from '@/lib/eventWorkspaceProjects';
import { parseNonNegativeInteger } from '@/lib/pagination';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const url = new URL(request.url);
    const requestedLimit = parseNonNegativeInteger(
      url.searchParams.get('limit'),
      DEFAULT_PAGE_SIZE
    );
    const offset = parseNonNegativeInteger(url.searchParams.get('offset'), 0);
    if (requestedLimit === null || requestedLimit < 1 || offset === null) {
      return NextResponse.json(
        { error: 'limit and offset must be valid positive integers.' },
        { status: 400 }
      );
    }

    const result = await listEventWorkspaceProjects({
      eventId: params.eventId,
      includeBanned: access.hacker!.role === 'SITE_ADMIN',
      take: Math.min(requestedLimit, MAX_PAGE_SIZE),
      skip: offset,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[EVENT_WORKSPACE_PROJECTS_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
