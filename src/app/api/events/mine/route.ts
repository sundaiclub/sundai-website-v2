import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const now = new Date();
    const events = await prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ startTime: { gte: now } }, { endTime: { gte: now } }],
        registrations: {
          some: {
            hackerId: hacker.id,
            status: 'APPROVED',
            cancelledAt: null,
          },
        },
      },
      orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        timezone: true,
        publicLocation: true,
        startTime: true,
        endTime: true,
        image: {
          select: {
            id: true,
            url: true,
            alt: true,
          },
        },
        chapter: {
          select: {
            id: true,
            slug: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    return NextResponse.json(
      events.map(event => ({
        ...event,
        chapterSlug: event.chapter.slug,
        chapterName: event.chapter.name,
      }))
    );
  } catch (error) {
    console.error('[MY_EVENTS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
