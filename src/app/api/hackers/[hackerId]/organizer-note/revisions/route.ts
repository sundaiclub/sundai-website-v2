import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  getOrganizerNoteAccessForActor,
  listOrganizerNoteRevisions,
  listOrganizerNoteRevisionsForEventActor,
} from '@/lib/organizerNotes';

export async function GET(
  request: Request,
  props: { params: Promise<{ hackerId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();
    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId')?.trim() || null;
    const chapterId = url.searchParams.get('chapterId')?.trim() || null;
    if ((eventId === null) === (chapterId === null)) {
      return badRequest('exactly one eventId or chapterId is required');
    }
    const take = Math.min(
      Math.max(Number(url.searchParams.get('take') ?? 25), 1),
      100
    );
    const skip = Math.max(Number(url.searchParams.get('skip') ?? 0), 0);
    if (!Number.isInteger(take) || !Number.isInteger(skip)) {
      return badRequest('take and skip must be integers');
    }

    if (eventId) {
      const revisions = await listOrganizerNoteRevisionsForEventActor({
        eventId,
        actorId: hacker.id,
        targetHackerId: params.hackerId,
        take,
        skip,
      });
      if (!revisions) return forbidden();
      return NextResponse.json({
        revisions,
        access: {
          canViewCurrentNote: true,
          canEditCurrentNote: true,
          canViewRevisions: true,
        },
      });
    }

    const { relevance } = await getOrganizerNoteAccessForActor(
      hacker.id,
      params.hackerId
    );
    const isSiteAdmin = hacker.role === 'SITE_ADMIN';
    const canAdministerChapter = relevance.chapterAdminChapterIds.includes(
      chapterId!
    );
    const targetIsRelevant = relevance.targetChapterIds.includes(chapterId!);
    const activeBan = isSiteAdmin
      ? null
      : await prisma.userBan.findFirst({
          where: { hackerId: params.hackerId, revokedAt: null },
          select: { id: true },
        });
    if (
      (!isSiteAdmin && !canAdministerChapter) ||
      !targetIsRelevant ||
      activeBan
    ) {
      return forbidden();
    }

    const revisions = await listOrganizerNoteRevisions(params.hackerId, {
      take,
      skip,
    });
    return NextResponse.json({
      revisions,
      access: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: true,
      },
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_REVISIONS_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
