import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireEventPitchManager } from "@/lib/eventManagementApi";

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { event, response } = await requireEventPitchManager(params.eventId);
    if (response) return response;

    if (event.phase !== "PITCHING") {
      return NextResponse.json({ message: "Can only advance during PITCHING phase" }, { status: 400 });
    }

    // Find current and next queued/approved
    const ordered = await prisma.eventProject.findMany({
      where: { eventId: params.eventId },
      orderBy: { position: 'asc' },
    });
    const currentIdx = ordered.findIndex(p => p.status === 'CURRENT');
    let nextIdx = -1;
    if (currentIdx === -1) {
      // No current: choose the first APPROVED/QUEUED
      nextIdx = ordered.findIndex(p => p.status === 'APPROVED' || p.status === 'QUEUED');
    } else {
      nextIdx = ordered.findIndex((p, idx) => idx > currentIdx && (p.status === 'APPROVED' || p.status === 'QUEUED'));
    }

    if (currentIdx !== -1) {
      // If still presenting/questions, mark as completed with timestamp
      const current = ordered[currentIdx];
      const completedData: Prisma.EventProjectUpdateInput = { status: 'DONE' };
      if (current.pitchPhase === 'PRESENTING' || current.pitchPhase === 'QUESTIONS') {
        completedData.pitchPhase = 'COMPLETED';
        completedData.completedAt = new Date();
        if (current.pitchPhase === 'PRESENTING') {
          completedData.questionsStartedAt = new Date();
        }
      }
      await prisma.eventProject.update({ where: { id: current.id }, data: completedData });
    }
    if (nextIdx !== -1) {
      await prisma.eventProject.update({ where: { id: ordered[nextIdx].id }, data: { status: 'CURRENT', approved: true, pitchPhase: 'WAITING' } });
    } else {
      await prisma.event.update({
        where: { id: params.eventId },
        data: { phase: 'FINISHED' },
      });
    }
    const updated = await prisma.event.findUnique({ where: { id: params.eventId }, include: { projects: { orderBy: { position: 'asc' } } } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EVENT_ADVANCE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
