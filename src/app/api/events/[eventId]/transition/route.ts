import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {
  DEFAULT_PRESENTING_SEC,
  DEFAULT_QUESTIONS_SEC,
  TOP_GROUP_PRESENTING_SEC,
  TOP_GROUP_QUESTIONS_SEC,
  getFrozenTopProjectIds,
  rankEventProjectsForPitching,
} from "@/lib/eventTopProjects";

const EVENT_PHASES = ["VOTING", "PITCHING", "FINISHED"] as const;

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.hacker.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
    if (!me) return new NextResponse("User not found", { status: 404 });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: { mcs: { select: { hackerId: true } } },
    });
    if (!event) return new NextResponse("Event not found", { status: 404 });

    const isMC = event.mcs.some(m => m.hackerId === me.id);
    const isAdmin = me.role === "ADMIN";
    if (!(isMC || isAdmin)) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetPhase = body?.targetPhase;

    if (!EVENT_PHASES.includes(targetPhase)) {
      return NextResponse.json({ message: "Valid targetPhase is required" }, { status: 400 });
    }

    if (targetPhase === event.phase) {
      return NextResponse.json({ message: `Event is already ${event.phase}` }, { status: 400 });
    }

    if (targetPhase === "FINISHED" || targetPhase === "VOTING") {
      const updated = await prisma.event.update({
        where: { id: params.eventId },
        data: { phase: targetPhase },
      });

      return NextResponse.json(updated);
    }

    let ops: Array<ReturnType<typeof prisma.eventProject.update> | ReturnType<typeof prisma.event.update>>;

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
          },
        })
      );
    } else {
      // Freshly entering pitching: rank by likes, assign positions/times, and start on the first project.
      const eventProjects = await prisma.eventProject.findMany({
        where: { eventId: params.eventId },
        include: {
          project: {
            include: { likes: { select: { id: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const sorted = rankEventProjectsForPitching(eventProjects);
      const topProjectIds = getFrozenTopProjectIds(sorted);

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
            allottedPresentingSec: isTopProject
              ? TOP_GROUP_PRESENTING_SEC
              : DEFAULT_PRESENTING_SEC,
            allottedQuestionsSec: isTopProject
              ? TOP_GROUP_QUESTIONS_SEC
              : DEFAULT_QUESTIONS_SEC,
          },
        });
      });
    }

    ops.push(
      prisma.event.update({
        where: { id: params.eventId },
        data: { phase: targetPhase },
      }) as any
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
