import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireEventPitchManager } from "@/lib/eventManagementApi";
import {
  getFrozenTopProjectIds,
  rankEventProjectsForPitching,
} from "@/lib/eventTopProjects";

const EVENT_PHASES = ["VOTING", "PITCHING", "FINISHED"] as const;
type EventPhaseTransition = (typeof EVENT_PHASES)[number];

function isEventPhaseTransition(value: unknown): value is EventPhaseTransition {
  return typeof value === "string" && EVENT_PHASES.includes(value as EventPhaseTransition);
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { event, response } = await requireEventPitchManager(params.eventId);
    if (response) return response;

    const body = (await req.json().catch(() => ({}))) as { targetPhase?: unknown };
    const targetPhase = body?.targetPhase;

    if (!isEventPhaseTransition(targetPhase)) {
      return NextResponse.json({ message: "Valid targetPhase is required" }, { status: 400 });
    }

    if (targetPhase === event.phase) {
      return NextResponse.json({ message: `Event is already ${event.phase}` }, { status: 400 });
    }

    if (targetPhase === "FINISHED") {
      const updated = await prisma.event.update({
        where: { id: params.eventId },
        data: { phase: targetPhase },
      });

      return NextResponse.json(updated);
    }

    if (targetPhase === "VOTING") {
      await prisma.$transaction([
        prisma.eventProject.updateMany({
          where: { eventId: params.eventId },
          data: { isTopProject: false },
        }),
        prisma.event.update({
          where: { id: params.eventId },
          data: { phase: targetPhase },
        }),
      ]);

      const updated = await prisma.event.findUnique({
        where: { id: params.eventId },
        include: {
          projects: { orderBy: { position: "asc" } },
        },
      });

      return NextResponse.json(updated);
    }

    let ops: Prisma.PrismaPromise<unknown>[];

    if (event.phase === "FINISHED") {
      const ordered = await prisma.eventProject.findMany({
        where: { eventId: params.eventId },
        orderBy: { position: "asc" },
      });

      ops = ordered.map((ep, idx) =>
        prisma.eventProject.update({
          where: { id: ep.id },
          data: {
            status: idx === 0 ? "CURRENT" : "APPROVED",
            approved: true,
            pitchPhase: "WAITING",
            presentingStartedAt: null,
            questionsStartedAt: null,
            completedAt: null,
            pausedAt: null,
          },
        })
      );
    } else {
      // Freshly entering pitching: rank by pitch likes, assign positions/times, and start on the first project.
      const eventProjects = await prisma.eventProject.findMany({
        where: { eventId: params.eventId },
        include: {
          pitchVotes: { select: { id: true, value: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const sorted = rankEventProjectsForPitching(eventProjects);
      const topProjectIds = getFrozenTopProjectIds(sorted, event.topProjectCount);

      ops = sorted.map((ep, idx) => {
        const isTopProject = topProjectIds.has(ep.id);
        return prisma.eventProject.update({
          where: { id: ep.id },
          data: {
            position: idx + 1,
            status: idx === 0 ? "CURRENT" : "APPROVED",
            approved: true,
            isTopProject,
            pitchPhase: "WAITING",
            presentingStartedAt: null,
            questionsStartedAt: null,
            completedAt: null,
            pausedAt: null,
            allottedPresentingSec: isTopProject
              ? event.topPresentingSec
              : event.defaultPresentingSec,
            allottedQuestionsSec: isTopProject
              ? event.topQuestionsSec
              : event.defaultQuestionsSec,
          },
        });
      });
    }

    ops.push(
      prisma.event.update({
        where: { id: params.eventId },
        data: { phase: targetPhase },
      })
    );

    await prisma.$transaction(ops);

    const updated = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        projects: { orderBy: { position: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EVENT_TRANSITION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
