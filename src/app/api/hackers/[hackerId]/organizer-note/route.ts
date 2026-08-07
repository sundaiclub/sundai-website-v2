import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  forbidden,
  getCurrentHacker,
  unauthorized,
} from '@/lib/eventManagementApi';
import {
  getCurrentOrganizerNote,
  getCurrentOrganizerNoteForEventActor,
  updateCurrentOrganizerNote,
  updateCurrentOrganizerNoteForEventActor,
} from '@/lib/organizerNotes';

function explicitScope(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId')?.trim() || null;
  const chapterId = url.searchParams.get('chapterId')?.trim() || null;
  return eventId === null && chapterId === null
    ? null
    : eventId !== null && chapterId !== null
      ? null
      : { eventId, chapterId };
}

async function canAccessChapterTarget(
  actor: { id: string; role?: string | null },
  chapterId: string,
  targetHackerId: string
) {
  const isSiteAdmin = actor.role === 'SITE_ADMIN';
  const membership = isSiteAdmin
    ? null
    : await prisma.chapterMembership.findFirst({
        where: {
          chapterId,
          hackerId: actor.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
  if (!isSiteAdmin && !membership) return false;

  const [targetMembership, targetRegistration, activeBan] = await Promise.all([
    prisma.chapterMembership.findFirst({
      where: {
        chapterId,
        hackerId: targetHackerId,
        status: { in: ['INVITED', 'ACTIVE'] },
      },
      select: { id: true },
    }),
    prisma.eventRegistration.findFirst({
      where: {
        hackerId: targetHackerId,
        status: { not: 'CANCELLED' },
        event: { chapterId },
      },
      select: { id: true },
    }),
    isSiteAdmin
      ? null
      : prisma.userBan.findFirst({
          where: { hackerId: targetHackerId, revokedAt: null },
          select: { id: true },
        }),
  ]);
  return !!(targetMembership || targetRegistration) && !activeBan;
}

export async function GET(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();
    const scope = explicitScope(request);
    if (!scope)
      return badRequest('exactly one eventId or chapterId is required');

    if (scope.eventId) {
      const note = await getCurrentOrganizerNoteForEventActor({
        eventId: scope.eventId,
        actorId: hacker.id,
        targetHackerId: params.hackerId,
      });
      if (!note) return forbidden();
      return NextResponse.json({
        note,
        access: {
          canViewCurrentNote: true,
          canEditCurrentNote: true,
          canViewRevisions: hacker.role === 'SITE_ADMIN',
        },
      });
    }

    if (
      !(await canAccessChapterTarget(hacker, scope.chapterId!, params.hackerId))
    ) {
      return forbidden();
    }
    const note = await getCurrentOrganizerNote(params.hackerId);
    return NextResponse.json({
      note,
      access: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: true,
      },
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();
    const scope = explicitScope(request);
    if (!scope)
      return badRequest('exactly one eventId or chapterId is required');
    const body = await request.json();
    if (typeof body?.body !== 'string') return badRequest('body is required');

    const note = scope.eventId
      ? await updateCurrentOrganizerNoteForEventActor({
          eventId: scope.eventId,
          actorId: hacker.id,
          targetHackerId: params.hackerId,
          body: body.body,
        })
      : (await canAccessChapterTarget(
            hacker,
            scope.chapterId!,
            params.hackerId
          ))
        ? await updateCurrentOrganizerNote({
            hackerId: params.hackerId,
            actorId: hacker.id,
            body: body.body,
          })
        : null;
    if (!note) return forbidden();

    return NextResponse.json({
      note,
      access: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions:
          hacker.role === 'SITE_ADMIN' || scope.chapterId !== null,
      },
    });
  } catch (error) {
    console.error('[ORGANIZER_NOTE_PUT]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
