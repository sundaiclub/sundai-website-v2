import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const now = new Date();
    const isSiteAdmin = hacker.role === 'SITE_ADMIN';
    const projectId = new URL(request.url).searchParams.get('projectId');

    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          launchLeadId: true,
          participants: { select: { hackerId: true } },
        },
      });
      const canEditProject =
        project &&
        (isSiteAdmin ||
          project.launchLeadId === hacker.id ||
          project.participants.some(member => member.hackerId === hacker.id));
      if (!canEditProject) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const events = await prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        startTime: { lte: now },
        endTime: { gte: now },
        ...(isSiteAdmin
          ? {}
          : {
              OR: [
                {
                  registrations: {
                    some: {
                      hackerId: hacker.id,
                      status: 'APPROVED' as const,
                      cancelledAt: null,
                    },
                  },
                },
                { staff: { some: { hackerId: hacker.id } } },
                {
                  chapter: {
                    memberships: {
                      some: {
                        hackerId: hacker.id,
                        role: 'ADMIN' as const,
                        status: 'ACTIVE' as const,
                      },
                    },
                  },
                },
              ],
            }),
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        image: { select: { url: true, alt: true } },
        chapter: { select: { id: true, name: true, slug: true } },
        ...(projectId
          ? {
              projects: {
                where: { projectId },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
      orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
    });

    return NextResponse.json(
      events.map(event => {
        const alreadyAdded = Boolean(
          projectId && 'projects' in event && event.projects.length > 0
        );

        return {
          ...event,
          chapterName: event.chapter.name,
          chapterSlug: event.chapter.slug,
          alreadyAdded,
          selectedByDefault: projectId ? alreadyAdded : !isSiteAdmin,
        };
      })
    );
  } catch (error) {
    console.error('[PROJECT_EVENT_OPTIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
