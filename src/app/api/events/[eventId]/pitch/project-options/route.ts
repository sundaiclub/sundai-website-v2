import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!hacker) return new NextResponse('User not found', { status: 404 });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        chapter: {
          select: {
            memberships: {
              where: {
                hackerId: hacker.id,
                role: 'ADMIN',
                status: 'ACTIVE',
              },
              select: { id: true },
              take: 1,
            },
          },
        },
        registrations: {
          where: {
            hackerId: hacker.id,
            status: 'APPROVED',
            cancelledAt: null,
          },
          select: { id: true },
          take: 1,
        },
        staff: {
          where: { hackerId: hacker.id },
          select: { id: true },
          take: 1,
        },
        pitchSessions: {
          select: { id: true, phase: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!event) return new NextResponse('Event not found', { status: 404 });

    const now = new Date();
    const pitchSession = event.pitchSessions[0];
    const canUseChooser =
      hacker.role === 'SITE_ADMIN' ||
      event.registrations.length > 0 ||
      event.staff.length > 0 ||
      (event.chapter?.memberships.length ?? 0) > 0;
    const isActive =
      event.startTime <= now && Boolean(event.endTime && event.endTime >= now);

    if (!canUseChooser) return new NextResponse('Forbidden', { status: 403 });
    if (!isActive || !pitchSession || pitchSession.phase === 'FINISHED') {
      return NextResponse.json(
        { message: 'This pitch is not open for project additions' },
        { status: 400 }
      );
    }

    const projects = await prisma.project.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { launchLeadId: hacker.id },
          { participants: { some: { hackerId: hacker.id } } },
        ],
      },
      select: {
        id: true,
        title: true,
        preview: true,
        startDate: true,
        eventParticipations: {
          where: { eventId: params.eventId },
          select: { id: true },
          take: 1,
        },
        pitchEntries: {
          where: { pitchSessionId: pitchSession.id },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ startDate: 'desc' }, { title: 'asc' }],
    });

    return NextResponse.json({
      projects: projects.map(project => ({
        id: project.id,
        title: project.title,
        preview: project.preview,
        startDate: project.startDate,
        eventAdded: project.eventParticipations.length > 0,
        pitchAdded: project.pitchEntries.length > 0,
      })),
    });
  } catch (error) {
    console.error('[PITCH_PROJECT_OPTIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
