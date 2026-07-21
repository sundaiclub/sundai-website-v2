import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';
import {
  getFrozenTopProjectIds,
  rankPitchProjectsForPitching,
} from '@/lib/eventTopProjects';

const EVENT_PHASES = ['VOTING', 'PITCHING', 'FINISHED'] as const;
type PitchSessionPhaseTransition = (typeof EVENT_PHASES)[number];

function isPitchSessionPhaseTransition(
  value: unknown
): value is PitchSessionPhaseTransition {
  return (
    typeof value === 'string' && EVENT_PHASES.some(phase => phase === value)
  );
}
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

    const body: unknown = await req.json().catch(() => ({}));
    const targetPhase =
      body !== null && typeof body === 'object' && 'targetPhase' in body
        ? body.targetPhase
        : undefined;

    if (!isPitchSessionPhaseTransition(targetPhase)) {
      return NextResponse.json(
        { message: 'Valid targetPhase is required' },
        { status: 400 }
      );
    }

    if (targetPhase === pitchSession.phase) {
      return NextResponse.json(
        { message: `Pitch session is already ${pitchSession.phase}` },
        { status: 400 }
      );
    }

    if (targetPhase === 'FINISHED') {
      const updated = await prisma.pitchSession.update({
        where: { id: pitchSession.id },
        data: { phase: targetPhase },
      });

      return NextResponse.json(updated);
    }

    if (targetPhase === 'VOTING') {
      await prisma.$transaction([
        prisma.pitchProject.updateMany({
          where: { pitchSessionId: pitchSession.id },
          data: { isTopProject: false },
        }),
        prisma.pitchSession.update({
          where: { id: pitchSession.id },
          data: { phase: targetPhase },
        }),
      ]);

      const updated = await prisma.pitchSession.findUnique({
        where: { id: pitchSession.id },
        include: {
          projects: { orderBy: { position: 'asc' } },
        },
      });

      return NextResponse.json(updated);
    }

    let ops: Prisma.PrismaPromise<unknown>[];

    if (pitchSession.phase === 'FINISHED') {
      const ordered = await prisma.pitchProject.findMany({
        where: { pitchSessionId: pitchSession.id },
        orderBy: { position: 'asc' },
      });

      ops = ordered.map((ep, idx) =>
        prisma.pitchProject.update({
          where: { id: ep.id },
          data: {
            status: idx === 0 ? 'CURRENT' : 'APPROVED',
            approved: true,
            pitchPhase: 'WAITING',
            presentingStartedAt: null,
            questionsStartedAt: null,
            completedAt: null,
            pausedAt: null,
          },
        })
      );
    } else {
      // Freshly entering pitching: rank by pitch likes, assign positions/times, and start on the first project.
      const pitchProjects = await prisma.pitchProject.findMany({
        where: { pitchSessionId: pitchSession.id },
        include: {
          pitchVotes: { select: { id: true, value: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const sorted = rankPitchProjectsForPitching(pitchProjects);
      const topProjectIds = getFrozenTopProjectIds(
        sorted,
        pitchSession.topProjectCount
      );

      ops = sorted.map((ep, idx) => {
        const isTopProject = topProjectIds.has(ep.id);
        return prisma.pitchProject.update({
          where: { id: ep.id },
          data: {
            position: idx + 1,
            status: idx === 0 ? 'CURRENT' : 'APPROVED',
            approved: true,
            isTopProject,
            pitchPhase: 'WAITING',
            presentingStartedAt: null,
            questionsStartedAt: null,
            completedAt: null,
            pausedAt: null,
            allottedPresentingSec: isTopProject
              ? pitchSession.topPresentingSec
              : pitchSession.defaultPresentingSec,
            allottedQuestionsSec: isTopProject
              ? pitchSession.topQuestionsSec
              : pitchSession.defaultQuestionsSec,
          },
        });
      });
    }

    ops.push(
      prisma.pitchSession.update({
        where: { id: pitchSession.id },
        data: { phase: targetPhase },
      })
    );

    await prisma.$transaction(ops);

    const updated = await prisma.pitchSession.findUnique({
      where: { id: pitchSession.id },
      include: {
        projects: { orderBy: { position: 'asc' } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[EVENT_TRANSITION_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
