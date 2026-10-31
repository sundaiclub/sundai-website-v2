import { NextResponse } from 'next/server';
import { requireEventWorkspaceAccess } from '@/lib/eventManagementApi';
import { loadEventWorkspace } from '@/lib/eventWorkspace';

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const workspace = await loadEventWorkspace(params.eventId, access.hacker!);
    if (!workspace) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('[EVENT_WORKSPACE_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
