import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  getCurrentHacker,
  isSiteAdmin,
  requireSiteAdmin,
} from '@/lib/eventManagementApi';
import { listVisibleChapters, normalizeChapterSlug } from '@/lib/chapters';

const chapterSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  region: true,
  country: true,
  timezone: true,
  description: true,
  status: true,
  accessMode: true,
  defaultDeclineMessage: true,
  mailingListName: true,
  mailingListExternalId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const hacker = await getCurrentHacker();
    const chapters = await listVisibleChapters({
      viewer: hacker ? { id: hacker.id, role: hacker.role } : null,
      includeViewerMembership: Boolean(hacker && !isSiteAdmin(hacker)),
    });

    return NextResponse.json(chapters);
  } catch (error) {
    console.error('[CHAPTERS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { hacker, response } = await requireSiteAdmin();
    if (response) return response;

    const body = await req.json();
    const name = body?.name?.trim();
    const city = body?.city?.trim();
    const country = body?.country?.trim();
    const timezone = body?.timezone?.trim();

    if (!name || !city || !country || !timezone) {
      return badRequest('name, city, country, and timezone are required');
    }

    const chapter = await prisma.chapter.create({
      data: {
        name,
        slug: normalizeChapterSlug(body?.slug || name),
        city,
        region: body?.region || null,
        country,
        timezone,
        description: body?.description || null,
        accessMode: body?.accessMode ?? 'PUBLIC',
        status: body?.status ?? 'ACTIVE',
        defaultDeclineMessage: body?.defaultDeclineMessage || null,
        mailingListName: body?.mailingListName || null,
        mailingListExternalId: body?.mailingListExternalId || null,
        memberships: body?.assignCreatorAsAdmin
          ? {
              create: {
                hackerId: hacker!.id,
                role: 'ADMIN',
                status: 'ACTIVE',
                joinedAt: new Date(),
              },
            }
          : undefined,
      },
      select: chapterSelect,
    });

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error('[CHAPTERS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
