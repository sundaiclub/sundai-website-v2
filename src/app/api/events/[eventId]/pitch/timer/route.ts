import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { response } = await requireEventPitchAccess(params.eventId);
    if (response) return response;

    const pitchSession = await prisma.pitchSession.findFirst({
      where: { eventId: params.eventId },
    });
    if (!pitchSession) {
      return new NextResponse('Pitch session not found', { status: 404 });
    }
    if (pitchSession.phase !== 'PITCHING') {
      return NextResponse.json(
        { message: 'Timer only available during PITCHING phase' },
        { status: 400 }
      );
    }

    const { action, pitchProjectId } = await req.json();
    const pitchProject = await prisma.pitchProject.findUnique({
      where: { id: pitchProjectId },
    });
    if (!pitchProject || pitchProject.pitchSessionId !== pitchSession.id) {
      return new NextResponse('PitchProject not found', { status: 404 });
    }
    if (pitchProject.status !== 'CURRENT') {
      return NextResponse.json(
        { message: 'Can only control timer for the CURRENT project' },
        { status: 400 }
      );
    }

    const now = new Date();

    switch (action) {
      case 'start': {
        if (pitchProject.timerPhase !== 'WAITING') {
          return NextResponse.json(
            { message: 'Timer already started' },
            { status: 400 }
          );
        }
        const allottedSec =
          pitchProject.allottedSec ??
          (pitchProject.isTopProject
            ? pitchSession.topPitchSec
            : pitchSession.defaultPitchSec);
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: {
            timerPhase: 'RUNNING',
            timerStartedAt: now,
            allottedSec,
          },
        });
        break;
      }
      case 'stop': {
        if (pitchProject.timerPhase !== 'RUNNING') {
          return NextResponse.json(
            { message: 'Timer must be running before it can stop' },
            { status: 400 }
          );
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: { timerPhase: 'COMPLETED', completedAt: now },
        });
        break;
      }
      default:
        return NextResponse.json(
          { message: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PITCH_TIMER_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
