import { projectEditLockResponse } from '@/lib/projectEditLock';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker, unauthorized } from '@/lib/eventManagementApi';
import {
  canManageEventJudgingWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import {
  judgingErrorResponse,
  saveProjectJudgingSubmission,
} from '@/lib/judgingData';

/** Saves the project's judging track and answers for one judging event. */
export async function PUT(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
    if (!body || !eventId) {
      return NextResponse.json(
        { message: 'Choose a judging event.' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: {
        launchLeadId: true,
        participants: { select: { hackerId: true } },
      },
    });
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found.' },
        { status: 404 }
      );
    }
    const isSiteAdmin = hacker.role === 'SITE_ADMIN';
    const onTeam =
      project.launchLeadId === hacker.id ||
      project.participants.some(member => member.hackerId === hacker.id);
    if (!isSiteAdmin && !onTeam) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const locked = await projectEditLockResponse(params.projectId, isSiteAdmin);
    if (locked) return locked;

    const permissionContext = await getEventPermissionContext(
      prisma,
      hacker.id,
      eventId
    );
    if (!permissionContext) {
      return NextResponse.json(
        { message: 'Event not found.' },
        { status: 404 }
      );
    }
    const canManageJudging =
      canManageEventJudgingWithContext(permissionContext);
    if (!canManageJudging) {
      const participant = await prisma.event.findFirst({
        where: {
          id: eventId,
          status: 'PUBLISHED',
          OR: [
            {
              registrations: {
                some: {
                  hackerId: hacker.id,
                  status: 'APPROVED',
                  cancelledAt: null,
                },
              },
            },
            { staff: { some: { hackerId: hacker.id } } },
          ],
        },
        select: { id: true },
      });
      if (!participant) {
        return NextResponse.json(
          { message: 'This event is not available to you.' },
          { status: 403 }
        );
      }
    }

    const result = await saveProjectJudgingSubmission({
      projectId: params.projectId,
      eventId,
      trackId: body.trackId,
      answers: body.answers,
      actorId: hacker.id,
      // Organizers can fix submissions after the window closes.
      bypassWindow: canManageJudging,
    });
    return NextResponse.json(result);
  } catch (error) {
    return judgingErrorResponse(error, '[PROJECT_JUDGING_PUT]');
  }
}
