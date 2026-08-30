import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { ProjectStatus } from '@prisma/client';
import prisma from '@/lib/prisma';

const PROJECT_STATUSES = new Set<ProjectStatus>([
  'DRAFT',
  'PENDING',
  'APPROVED',
]);

function stringIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    )
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const status = body?.status as ProjectStatus;
    const eventIds = stringIds(body?.eventIds);
    const sourceEventId =
      typeof body?.sourceEventId === 'string' ? body.sourceEventId : null;

    if (!PROJECT_STATUSES.has(status)) {
      return NextResponse.json(
        { message: 'A valid project status is required' },
        { status: 400 }
      );
    }

    const currentUser = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return new NextResponse('User not found', { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        participants: {
          select: { hackerId: true },
        },
      },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const isAdmin = currentUser.role === 'SITE_ADMIN';
    const isLaunchLead = project.launchLeadId === currentUser.id;
    const isTeamMember = project.participants.some(
      p => p.hackerId === currentUser.id
    );

    if (!isAdmin && !isLaunchLead && !isTeamMember) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (eventIds.length === 0 || status !== 'APPROVED') {
      const updatedProject = await prisma.project.update({
        where: { id: params.projectId },
        data: { status },
      });

      return NextResponse.json(updatedProject);
    }

    const events = await prisma.event.findMany({
      where: {
        id: { in: eventIds },
        status: 'PUBLISHED',
        ...(isAdmin
          ? {}
          : {
              registrations: {
                some: {
                  hackerId: currentUser.id,
                  status: 'APPROVED',
                  cancelledAt: null,
                },
              },
            }),
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        pitchSessions: {
          select: { id: true, phase: true, defaultPitchSec: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (events.length !== eventIds.length) {
      return NextResponse.json(
        { message: 'One or more selected events are not available to you' },
        { status: 403 }
      );
    }

    const now = new Date();
    const sourceEvent = sourceEventId
      ? events.find(event => event.id === sourceEventId)
      : null;
    const sourcePitch = sourceEvent?.pitchSessions[0];
    const sourceIsHappening = Boolean(
      sourceEvent &&
        sourceEvent.startTime <= now &&
        sourceEvent.endTime &&
        sourceEvent.endTime >= now
    );
    const shouldJoinPitch = Boolean(
      sourcePitch && sourceIsHappening && sourcePitch.phase !== 'FINISHED'
    );
    const lastPitchProject = shouldJoinPitch
      ? await prisma.pitchProject.findFirst({
          where: { pitchSessionId: sourcePitch!.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      : null;

    const operations = [
      prisma.project.update({
        where: { id: params.projectId },
        data: { status },
      }),
      ...events.map(event =>
        prisma.eventProject.upsert({
          where: {
            eventId_projectId: {
              eventId: event.id,
              projectId: params.projectId,
            },
          },
          create: {
            eventId: event.id,
            projectId: params.projectId,
            addedById: currentUser.id,
          },
          update: {},
        })
      ),
      ...(shouldJoinPitch
        ? [
            prisma.pitchProject.create({
              data: {
                pitchSessionId: sourcePitch!.id,
                projectId: params.projectId,
                addedById: currentUser.id,
                position: (lastPitchProject?.position ?? 0) + 1,
                isTopProject: false,
                ...(sourcePitch!.phase === 'PITCHING' && {
                  allottedSec: sourcePitch!.defaultPitchSec,
                }),
              },
            }),
          ]
        : []),
    ];
    const [updatedProject] = await prisma.$transaction(operations);

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('[PROJECT_STATUS_UPDATE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
