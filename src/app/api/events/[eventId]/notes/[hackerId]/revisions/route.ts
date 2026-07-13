import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventWorkspaceAccess } from '@/lib/eventManagementApi';
import {
  canAdministerEventWithContext,
  getChapterMembershipForPermissions,
} from '@/lib/eventManagementAuth';
import { listOrganizerNoteRevisionsForEventActor } from '@/lib/organizerNotes';

function positiveInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: { eventId: string; hackerId: string };
  }
) {
  try {
    const access = await requireEventWorkspaceAccess(params.eventId);
    if (access.response) return access.response;

    const chapterMembership = await getChapterMembershipForPermissions(
      prisma,
      access.hacker!.id,
      access.event!.chapterId
    );
    if (
      !canAdministerEventWithContext({
        actor: access.hacker,
        chapterMembership,
        staff: null,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const take = positiveInteger(url.searchParams.get('take'), 50);
    const skip = positiveInteger(url.searchParams.get('skip'), 0);
    if (take === null || take === 0 || skip === null) {
      return NextResponse.json(
        { error: 'take must be positive and skip must be non-negative.' },
        { status: 400 }
      );
    }

    const revisions = await listOrganizerNoteRevisionsForEventActor({
      eventId: params.eventId,
      actorId: access.hacker!.id,
      targetHackerId: params.hackerId,
      take,
      skip,
    });
    if (revisions === null) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      items: revisions,
      nextSkip:
        revisions.length === Math.min(take, 100)
          ? skip + revisions.length
          : null,
    });
  } catch (error) {
    console.error('[EVENT_ORGANIZER_NOTE_REVISIONS_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
