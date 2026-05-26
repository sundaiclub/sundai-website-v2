import { NextResponse } from 'next/server';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  getCurrentOrganizerNote,
  getOrganizerNoteAccessForActor,
  updateCurrentOrganizerNote,
} from '@/lib/organizerNotes';

export async function GET(
  _req: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const { access } = await getOrganizerNoteAccessForActor(
      hacker.id,
      params.hackerId
    );
    if (!access.canViewCurrentNote) return forbidden();

    const note = await getCurrentOrganizerNote(params.hackerId);

    return NextResponse.json({
      note,
      access,
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const { access } = await getOrganizerNoteAccessForActor(
      hacker.id,
      params.hackerId
    );
    if (!access.canEditCurrentNote) return forbidden();

    const body = await req.json();
    if (typeof body?.body !== 'string') {
      return badRequest('body is required');
    }

    const note = await updateCurrentOrganizerNote({
      hackerId: params.hackerId,
      actorId: hacker.id,
      body: body.body,
    });

    return NextResponse.json({
      note,
      access,
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_PUT]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
