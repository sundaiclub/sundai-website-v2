import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventNotesManager } from '@/lib/eventManagementApi';
import { listEventOrganizerNoteTargets } from '@/lib/organizerNotes';
import { parseNonNegativeInteger } from '@/lib/pagination';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

export async function GET(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventNotesManager(params.eventId);
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
    const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    const search = url.searchParams.get('search')?.trim() ?? '';
    if (search.length > MAX_SEARCH_LENGTH) {
      return NextResponse.json(
        { error: `search must be ${MAX_SEARCH_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    const projected = await listEventOrganizerNoteTargets({
      eventId: params.eventId,
      actorId: access.hacker!.id,
      search: search || undefined,
      take: limit + 1,
      skip: offset,
      db: prisma,
    });
    const hasMore = projected.length > limit;
    const page = hasMore ? projected.slice(0, limit) : projected;
    const hackerIds = page.map(row => row.hackerId);
    const hackers = hackerIds.length
      ? await prisma.hacker.findMany({
          where: {
            id: { in: hackerIds },
            userBans: { none: { revokedAt: null } },
          },
          select: {
            id: true,
            name: true,
            organizerNote: {
              select: {
                id: true,
                hackerId: true,
                body: true,
                updatedById: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })
      : [];
    const hackerById = new Map(hackers.map(hacker => [hacker.id, hacker]));
    const items = page.flatMap(row => {
      const hacker = hackerById.get(row.hackerId);
      return hacker ? [{ hacker, note: hacker.organizerNote ?? null }] : [];
    });

    return NextResponse.json({
      items,
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (error) {
    console.error('[EVENT_ORGANIZER_NOTES_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
