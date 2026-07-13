import { NextResponse } from 'next/server';
import { requireEventWorkspaceAccess } from '@/lib/eventManagementApi';
import { updateEventProjectCardStatus } from '@/lib/eventWorkspaceProjects';
import type { EventProjectCardStatus } from '@/types/event-workspace';

type RouteContext = {
  params: { eventId: string; pitchProjectId: string };
};

const CARD_STATUSES = new Set<EventProjectCardStatus>([
  'DRAFT',
  'NEEDS_INFO',
  'SUBMITTED',
  'APPROVED',
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonError('Request body must be valid JSON.', 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonError('Request body must be a JSON object.', 400);
    }

    const input = payload as Record<string, unknown>;
    if (
      Object.keys(input).length !== 1 ||
      typeof input.cardStatus !== 'string' ||
      !CARD_STATUSES.has(input.cardStatus as EventProjectCardStatus)
    ) {
      return jsonError('Only a valid cardStatus may be updated.', 400);
    }

    const project = await updateEventProjectCardStatus({
      eventId: params.eventId,
      pitchProjectId: params.pitchProjectId,
      cardStatus: input.cardStatus as EventProjectCardStatus,
    });
    if (!project) return jsonError('Project participation not found.', 404);

    return NextResponse.json({
      id: project.id,
      cardStatus: project.cardStatus,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Project card status is invalid.'
    ) {
      return jsonError(error.message, 400);
    }
    console.error('[EVENT_WORKSPACE_PROJECT_PATCH]', error);
    return jsonError('Internal Server Error', 500);
  }
}
