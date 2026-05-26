import { NextResponse } from 'next/server';
import {
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  getOrganizerNoteAccessForActor,
  listOrganizerNoteRevisions,
} from '@/lib/organizerNotes';

export async function GET(
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
    if (!access.canViewRevisions) return forbidden();

    const url = new URL(req.url);
    const take = Number(url.searchParams.get('take') ?? 25);
    const skip = Number(url.searchParams.get('skip') ?? 0);

    const revisions = await listOrganizerNoteRevisions(params.hackerId, {
      take: Number.isFinite(take) ? take : 25,
      skip: Number.isFinite(skip) ? skip : 0,
    });

    return NextResponse.json({
      revisions,
      access,
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_REVISIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
