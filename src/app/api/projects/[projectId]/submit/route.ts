import { projectEditLockResponse } from '@/lib/projectEditLock';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { ProjectStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  projectEventAccessWhere,
  projectEventWindowWhere,
} from '@/lib/projectEvents';
import {
  GITHUB_URL_REQUIRED_MESSAGE,
  meetsGithubUrlRequirement,
} from '@/lib/projectSubmissionRequirements';

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
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const status = body?.status as ProjectStatus;
    const eventIds = stringIds(body?.eventIds);
    const removedEventIds = stringIds(body?.removedEventIds).filter(
      eventId => !eventIds.includes(eventId)
    );
    const pitchEventIds = stringIds(body?.pitchEventIds).filter(eventId =>
      eventIds.includes(eventId)
    );

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

    const locked = await projectEditLockResponse(params.projectId, isAdmin);
    if (locked) return locked;

    const syncDraftEvents =
      project.status === 'DRAFT' && Array.isArray(body?.eventIds);
    if (
      (!syncDraftEvents &&
        eventIds.length === 0 &&
        removedEventIds.length === 0) ||
      (status !== 'APPROVED' && !(syncDraftEvents && status === 'DRAFT'))
    ) {
      const updatedProject = await prisma.project.update({
        where: { id: params.projectId },
        data: { status },
      });

      return NextResponse.json(updatedProject);
    }

    const requestedEventIds = [...eventIds, ...removedEventIds];
    const accessibleEvents = await prisma.event.findMany({
      where: {
        id: { in: requestedEventIds },
        ...projectEventAccessWhere(currentUser),
        AND: [
          {
            OR: [
              { id: { in: removedEventIds } },
              // Retain existing published participation when saving later edits.
              ...(project.status === 'APPROVED'
                ? [{ projects: { some: { projectId: params.projectId } } }]
                : []),
              projectEventWindowWhere(new Date()),
            ],
          },
        ],
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        requireGithubUrl: true,
        judgingEnabled: true,
        pitchSessions: {
          select: { id: true, phase: true, defaultPitchSec: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (accessibleEvents.length !== requestedEventIds.length) {
      return NextResponse.json(
        {
          message:
            'One or more selected events are unavailable or submissions have closed',
        },
        { status: 403 }
      );
    }

    const events = accessibleEvents.filter(event =>
      eventIds.includes(event.id)
    );
    if (
      status === 'APPROVED' &&
      events.some(event => event.requireGithubUrl) &&
      !meetsGithubUrlRequirement(project.githubUrl)
    ) {
      return NextResponse.json(
        { message: GITHUB_URL_REQUIRED_MESSAGE },
        { status: 400 }
      );
    }
    const pitchEntriesToRemove =
      removedEventIds.length > 0
        ? await prisma.pitchProject.findMany({
            where: {
              projectId: params.projectId,
              pitchSession: { eventId: { in: removedEventIds } },
            },
            select: { id: true },
          })
        : [];
    const pitchEntryIdsToRemove = pitchEntriesToRemove.map(entry => entry.id);

    const now = new Date();
    const pitchSessions =
      status === 'APPROVED'
        ? events.flatMap(event => {
            const pitch = event.pitchSessions[0];
            const isHappening =
              event.startTime <= now &&
              event.endTime !== null &&
              event.endTime >= now;
            return pitchEventIds.includes(event.id) &&
              !event.judgingEnabled &&
              pitch &&
              isHappening &&
              pitch.phase !== 'FINISHED'
              ? [pitch]
              : [];
          })
        : [];
    const existingPitchEntries =
      pitchSessions.length > 0
        ? await prisma.pitchProject.findMany({
            where: {
              projectId: params.projectId,
              pitchSessionId: { in: pitchSessions.map(pitch => pitch.id) },
            },
            select: { pitchSessionId: true },
          })
        : [];
    const pitchSessionsToJoin = pitchSessions.filter(
      pitch =>
        !existingPitchEntries.some(entry => entry.pitchSessionId === pitch.id)
    );
    const lastPitchPositions = await Promise.all(
      pitchSessionsToJoin.map(pitch =>
        prisma.pitchProject.findFirst({
          where: { pitchSessionId: pitch.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      )
    );

    const operations = [
      prisma.project.update({
        where: { id: params.projectId },
        data: { status },
      }),
      ...(syncDraftEvents
        ? [
            prisma.eventProject.deleteMany({
              where: {
                projectId: params.projectId,
                eventId: { notIn: eventIds },
              },
            }),
          ]
        : []),
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
      ...pitchSessionsToJoin.map((pitch, index) =>
        prisma.pitchProject.create({
          data: {
            pitchSessionId: pitch.id,
            projectId: params.projectId,
            addedById: currentUser.id,
            position: (lastPitchPositions[index]?.position ?? 0) + 1,
            isTopProject: false,
            ...(pitch.phase === 'PITCHING' && {
              allottedSec: pitch.defaultPitchSec,
            }),
          },
        })
      ),
      ...(removedEventIds.length > 0
        ? [
            prisma.pitchProjectVote.deleteMany({
              where: { pitchProjectId: { in: pitchEntryIdsToRemove } },
            }),
            prisma.pitchProject.deleteMany({
              where: { id: { in: pitchEntryIdsToRemove } },
            }),
            prisma.eventProject.deleteMany({
              where: {
                projectId: params.projectId,
                eventId: { in: removedEventIds },
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
