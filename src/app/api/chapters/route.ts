import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isChapterTimezone } from '@/lib/chapterTimezones';
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
  heroImageId: true,
  heroImage: { select: { id: true, url: true, alt: true, filename: true } },
  status: true,
  accessMode: true,
  mailingListName: true,
  mailingListExternalId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const manageableOnly = url.searchParams.get('manageable') === 'true';
    const hacker = await getCurrentHacker();

    if (manageableOnly && !hacker) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (manageableOnly) {
      const chapters = await prisma.chapter.findMany({
        where: isSiteAdmin(hacker!)
          ? {}
          : {
              memberships: {
                some: {
                  hackerId: hacker!.id,
                  role: 'ADMIN',
                  status: 'ACTIVE',
                },
              },
            },
        include: {
          heroImage: {
            select: { id: true, url: true, alt: true, filename: true },
          },
          memberships: {
            where: { hackerId: hacker!.id },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      });

      if (!isSiteAdmin(hacker!) && chapters.length === 0) {
        return new NextResponse('Forbidden', { status: 403 });
      }

      return NextResponse.json(chapters);
    }

    const chapters = await listVisibleChapters({
      viewer: hacker ? { id: hacker.id, role: hacker.role } : null,
      includeViewerMembership: Boolean(hacker),
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

    if (!isChapterTimezone(timezone)) {
      return badRequest('timezone must be a supported IANA timezone');
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
