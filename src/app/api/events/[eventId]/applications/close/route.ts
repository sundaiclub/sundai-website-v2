import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  requireEventAdministrator,
} from '@/lib/eventManagementApi';

type CloseApplicationsBody = {
  reason?: unknown;
};

type CloseApplicationsBodyResult =
  | { ok: true; body: CloseApplicationsBody }
  | { ok: false; response: Response };

async function readCloseApplicationsBody(
  req: Request
): Promise<CloseApplicationsBodyResult> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: badRequest('Request body must be valid JSON'),
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      response: badRequest('Request body must be a JSON object'),
    };
  }

  return { ok: true, body: body as CloseApplicationsBody };
}

export async function POST(
  req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const { hacker, response } = await requireEventAdministrator(
      params.eventId
    );
    if (response) return response;

    const parsedBody = await readCloseApplicationsBody(req);
    if (!parsedBody.ok) return parsedBody.response;

    const { body } = parsedBody;

    if (
      body.reason !== undefined &&
      body.reason !== null &&
      typeof body.reason !== 'string'
    ) {
      return badRequest('reason must be a string');
    }

    const trimmedReason =
      typeof body.reason === 'string' ? body.reason.trim() : '';
    const reason = trimmedReason.length > 0 ? trimmedReason : null;

    const event = await prisma.event.update({
      where: { id: params.eventId },
      data: {
        applicationsOpen: false,
        applicationsClosedAt: new Date(),
        applicationsClosedById: hacker.id,
        applicationsCloseReason: reason,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_APPLICATIONS_CLOSE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
