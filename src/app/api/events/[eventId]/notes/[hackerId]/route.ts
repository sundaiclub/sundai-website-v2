import { NextResponse } from 'next/server';
import { requireEventNotesManager } from '@/lib/eventManagementApi';
import {
  getCurrentOrganizerNoteForEventActor,
  updateCurrentOrganizerNoteForEventActor,
} from '@/lib/organizerNotes';

type RouteContext = {
  params: { eventId: string; hackerId: string };
};

function notFound() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const access = await requireEventNotesManager(params.eventId);
    if (access.response) return access.response;

    const note = await getCurrentOrganizerNoteForEventActor({
      eventId: params.eventId,
      actorId: access.hacker!.id,
      targetHackerId: params.hackerId,
    });
    if (!note) return notFound();

    return NextResponse.json({ note });
  } catch (error) {
    console.error('[EVENT_ORGANIZER_NOTE_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const access = await requireEventNotesManager(params.eventId);
    if (access.response) return access.response;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof (payload as { body?: unknown }).body !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Note body must be a string.' },
        { status: 400 }
      );
    }

    const body = (payload as { body: string }).body;
    if (body.length > 20_000) {
      return NextResponse.json(
        { error: 'Note body is too long.' },
        { status: 400 }
      );
    }

    const note = await updateCurrentOrganizerNoteForEventActor({
      eventId: params.eventId,
      actorId: access.hacker!.id,
      targetHackerId: params.hackerId,
      body,
    });
    if (!note) return notFound();

    return NextResponse.json({ note });
  } catch (error) {
    console.error('[EVENT_ORGANIZER_NOTE_PUT]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
