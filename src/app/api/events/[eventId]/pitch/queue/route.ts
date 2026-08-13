import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';

// Join queue by adding one of user's projects
export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const user = await prisma.hacker.findUnique({ where: { clerkId: userId } });
    if (!user) return new NextResponse('User not found', { status: 404 });

    const body = await req.json();
    const { projectId } = body || {};
    if (!projectId)
      return NextResponse.json(
        { message: 'projectId required' },
        { status: 400 }
      );

    const pitchSession = await prisma.pitchSession.findFirst({
      where: { eventId: params.eventId },
    });
    if (!pitchSession)
      return new NextResponse('Pitch session not found', { status: 404 });
    if (pitchSession.phase === 'FINISHED') {
      return NextResponse.json(
        { message: 'Cannot add projects to a finished event' },
        { status: 400 }
      );
    }

    // Verify the user owns or participates in the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        participants: { include: { hacker: true } },
      },
    });
    if (!project) return new NextResponse('Project not found', { status: 404 });

    const isOwnerOrParticipant =
      project.launchLeadId === user.id ||
      project.participants.some(p => p.hacker.id === user.id);

    if (!isOwnerOrParticipant) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Prevent duplicates
    const existing = await prisma.pitchProject.findUnique({
      where: {
        pitchSessionId_projectId: {
          pitchSessionId: pitchSession.id,
          projectId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'Project already in queue' },
        { status: 409 }
      );
    }

    const last = await prisma.pitchProject.findFirst({
      where: { pitchSessionId: pitchSession.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPos = (last?.position || 0) + 1;

    const [, item] = await prisma.$transaction([
      prisma.eventProject.upsert({
        where: {
          eventId_projectId: { eventId: params.eventId, projectId },
        },
        create: {
          eventId: params.eventId,
          projectId,
          addedById: user.id,
        },
        update: {},
      }),
      prisma.pitchProject.create({
        data: {
        pitchSessionId: pitchSession.id,
        projectId,
        addedById: user.id,
        position: nextPos,
        isTopProject: false,
        ...(pitchSession.phase === 'PITCHING' && {
          allottedSec: pitchSession.defaultPitchSec,
        }),
        },
      }),
    ]);

    return NextResponse.json(item);
  } catch (error) {
    console.error('[QUEUE_JOIN_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// Reorder queue: accepts array of { id, position }. Admins or audience based on flag
export async function PATCH(
  req: Request,
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
      include: { staff: { select: { hackerId: true, role: true } } },
    });
    if (!event) return new NextResponse('Event not found', { status: 404 });
    const pitchSession = await prisma.pitchSession.findFirst({
      where: { eventId: params.eventId },
    });
    if (!pitchSession)
      return new NextResponse('Pitch session not found', { status: 404 });

    const allowAll = pitchSession.audienceCanReorder
      ? true
      : !(await requireEventPitchAccess(params.eventId)).response;

    const { items } = await req.json();
    if (!Array.isArray(items))
      return NextResponse.json(
        { message: 'items array required' },
        { status: 400 }
      );

    // Top-group protection during PITCHING phase
    if (pitchSession.phase === 'PITCHING') {
      const allProjects = await prisma.pitchProject.findMany({
        where: { pitchSessionId: pitchSession.id },
        orderBy: { position: 'asc' },
      });

      const topGroupIds = new Set(
        allProjects.filter(ep => ep.isTopProject).map(ep => ep.id)
      );
      const topGroupPositions = new Set(
        allProjects.filter(ep => ep.isTopProject).map(ep => ep.position)
      );

      const ids = items.map((it: { id: string }) => it.id);

      // Reject if any items being moved are in the top group
      if (ids.some((id: string) => topGroupIds.has(id))) {
        return NextResponse.json(
          { message: 'Cannot reorder top-group projects' },
          { status: 400 }
        );
      }

      // Reject if any items are being moved into top-group positions
      if (
        items.some((it: { position: number }) =>
          topGroupPositions.has(it.position)
        )
      ) {
        return NextResponse.json(
          { message: 'Cannot move into top-group positions' },
          { status: 400 }
        );
      }
    }

    if (!allowAll) {
      if (items.length === 0) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
      // Owners can only move their own items and not before the CURRENT item
      const ids = items.map((it: { id: string }) => it.id);
      const eps = await prisma.pitchProject.findMany({
        where: { id: { in: ids } },
        select: { id: true, addedById: true, pitchSessionId: true },
      });
      if (eps.length !== ids.length)
        return new NextResponse('Not found', { status: 404 });
      if (eps.some(ep => ep.pitchSessionId !== pitchSession.id))
        return new NextResponse('Bad Request', { status: 400 });
      if (eps.some(ep => ep.addedById !== hacker.id))
        return new NextResponse('Unauthorized', { status: 401 });

      const current = await prisma.pitchProject.findFirst({
        where: { pitchSessionId: pitchSession.id, status: 'CURRENT' },
        select: { position: true },
      });
      if (current) {
        const invalid = items.some(
          (it: { position: number }) => it.position <= current.position
        );
        if (invalid)
          return new NextResponse('Cannot move before current', {
            status: 400,
          });
      }
    }

    const ops = items.map((it: { id: string; position: number }) =>
      prisma.pitchProject.update({
        where: { id: it.id },
        data: { position: it.position },
      })
    );
    await prisma.$transaction(ops);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[QUEUE_REORDER_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
