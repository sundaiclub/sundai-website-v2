import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireEventPitchAccess } from '@/lib/eventManagementApi';

export async function POST(
  req: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
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
        { message: 'Can only advance during PITCHING phase' },
        { status: 400 }
      );
    }

    // Find current and next queued/approved
    const ordered = await prisma.pitchProject.findMany({
      where: { pitchSessionId: pitchSession.id },
      orderBy: { position: 'asc' },
    });
    const currentIdx = ordered.findIndex(p => p.status === 'CURRENT');
    let nextIdx = -1;
    if (currentIdx === -1) {
      // No current: choose the first APPROVED/QUEUED
      nextIdx = ordered.findIndex(
        p => p.status === 'APPROVED' || p.status === 'QUEUED'
      );
    } else {
      nextIdx = ordered.findIndex(
        (p, idx) =>
          idx > currentIdx && (p.status === 'APPROVED' || p.status === 'QUEUED')
      );
    }

    if (currentIdx !== -1) {
      // If the timer is running, stop it before advancing.
      const current = ordered[currentIdx];
      const completedData: Prisma.PitchProjectUpdateInput = { status: 'DONE' };
      if (current.timerPhase === 'RUNNING') {
        completedData.timerPhase = 'COMPLETED';
        completedData.completedAt = new Date();
      }
      await prisma.pitchProject.update({
        where: { id: current.id },
        data: completedData,
      });
    }
    if (nextIdx !== -1) {
      await prisma.pitchProject.update({
        where: { id: ordered[nextIdx].id },
        data: { status: 'CURRENT', approved: true, timerPhase: 'WAITING' },
      });
    } else {
      await prisma.pitchSession.update({
        where: { id: pitchSession.id },
        data: { phase: 'FINISHED' },
      });
    }
    const updated = await prisma.pitchSession.findUnique({
      where: { id: pitchSession.id },
      include: { projects: { orderBy: { position: 'asc' } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[EVENT_ADVANCE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
