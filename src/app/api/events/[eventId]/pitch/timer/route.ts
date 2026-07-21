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
    if (!pitchSession)
      return new NextResponse('Pitch session not found', { status: 404 });

    if (pitchSession.phase !== 'PITCHING') {
      return NextResponse.json(
        { message: 'Timer only available during PITCHING phase' },
        { status: 400 }
      );
    }

    const { action, pitchProjectId } = await req.json();

    const ep = await prisma.pitchProject.findUnique({
      where: { id: pitchProjectId },
    });
    if (!ep || ep.pitchSessionId !== pitchSession.id) {
      return new NextResponse('PitchProject not found', { status: 404 });
    }
    if (ep.status !== 'CURRENT') {
      return NextResponse.json(
        { message: 'Can only control timer for the CURRENT project' },
        { status: 400 }
      );
    }

    const now = new Date();

    switch (action) {
      case 'start_presenting': {
        if (ep.pitchPhase !== 'WAITING') {
          return NextResponse.json(
            { message: 'Presenting already started' },
            { status: 400 }
          );
        }
        // Backfill allotted times if missing (events transitioned before migration)
        let allottedData: {
          allottedPresentingSec?: number;
          allottedQuestionsSec?: number;
        } = {};
        if (
          ep.allottedPresentingSec == null ||
          ep.allottedQuestionsSec == null
        ) {
          const isTopProject = ep.isTopProject;
          allottedData = {
            allottedPresentingSec: isTopProject
              ? pitchSession.topPresentingSec
              : pitchSession.defaultPresentingSec,
            allottedQuestionsSec: isTopProject
              ? pitchSession.topQuestionsSec
              : pitchSession.defaultQuestionsSec,
          };
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: {
            pitchPhase: 'PRESENTING',
            presentingStartedAt: now,
            ...allottedData,
          },
        });
        break;
      }
      case 'start_questions': {
        if (ep.pitchPhase !== 'PRESENTING') {
          return NextResponse.json(
            { message: 'Must be presenting to start questions' },
            { status: 400 }
          );
        }
        if (ep.pausedAt) {
          return NextResponse.json(
            { message: 'Resume the timer before starting Q&A' },
            { status: 400 }
          );
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: { pitchPhase: 'QUESTIONS', questionsStartedAt: now },
        });
        break;
      }
      case 'finish': {
        if (ep.pitchPhase !== 'QUESTIONS') {
          return NextResponse.json(
            { message: 'Must be in questions to finish' },
            { status: 400 }
          );
        }
        if (ep.pausedAt) {
          return NextResponse.json(
            { message: 'Resume the timer before finishing' },
            { status: 400 }
          );
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: { pitchPhase: 'COMPLETED', completedAt: now },
        });
        break;
      }
      case 'pause': {
        if (ep.pitchPhase !== 'PRESENTING' && ep.pitchPhase !== 'QUESTIONS') {
          return NextResponse.json(
            { message: 'Can only pause during PRESENTING or QUESTIONS' },
            { status: 400 }
          );
        }
        if (ep.pausedAt) {
          return NextResponse.json(
            { message: 'Timer is already paused' },
            { status: 400 }
          );
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: { pausedAt: now },
        });
        break;
      }
      case 'resume': {
        if (!ep.pausedAt) {
          return NextResponse.json(
            { message: 'Timer is not paused' },
            { status: 400 }
          );
        }
        const pausedMs = now.getTime() - ep.pausedAt.getTime();
        const shifted: {
          presentingStartedAt?: Date;
          questionsStartedAt?: Date;
        } = {};
        if (ep.presentingStartedAt) {
          shifted.presentingStartedAt = new Date(
            ep.presentingStartedAt.getTime() + pausedMs
          );
        }
        if (ep.questionsStartedAt) {
          shifted.questionsStartedAt = new Date(
            ep.questionsStartedAt.getTime() + pausedMs
          );
        }
        await prisma.pitchProject.update({
          where: { id: pitchProjectId },
          data: { pausedAt: null, ...shifted },
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
