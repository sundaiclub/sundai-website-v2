import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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

    if (event.phase !== "PITCHING") {
      return NextResponse.json({ message: "Timer only available during PITCHING phase" }, { status: 400 });
    }

    const { action, eventProjectId } = await req.json();

    const ep = await prisma.eventProject.findUnique({ where: { id: eventProjectId } });
    if (!ep || ep.eventId !== params.eventId) {
      return new NextResponse("EventProject not found", { status: 404 });
    }
    if (ep.status !== "CURRENT") {
      return NextResponse.json({ message: "Can only control timer for the CURRENT project" }, { status: 400 });
    }

    const now = new Date();

    switch (action) {
      case "start_presenting": {
        if (ep.pitchPhase !== "WAITING") {
          return NextResponse.json({ message: "Presenting already started" }, { status: 400 });
        }
        // Backfill allotted times if missing (events transitioned before migration)
        let allottedData: { allottedPresentingSec?: number; allottedQuestionsSec?: number } = {};
        if (ep.allottedPresentingSec == null || ep.allottedQuestionsSec == null) {
          const allProjects = await prisma.eventProject.findMany({
            where: { eventId: params.eventId },
            include: { project: { include: { likes: { select: { id: true } } } } },
            orderBy: { position: "asc" },
          });
          const likeCounts = allProjects.map(p => p.project.likes.length).sort((a: number, b: number) => b - a);
          const threshold = likeCounts.length >= 5 ? likeCounts[4] : -1;
          const thisLikes = allProjects.find(p => p.id === eventProjectId)?.project.likes.length ?? 0;
          const isTopGroup = threshold >= 0 && thisLikes >= threshold;
          allottedData = {
            allottedPresentingSec: isTopGroup ? 120 : 60,
            allottedQuestionsSec: isTopGroup ? 180 : 120,
          };
        }
        await prisma.eventProject.update({
          where: { id: eventProjectId },
          data: { pitchPhase: "PRESENTING", presentingStartedAt: now, ...allottedData },
        });
        break;
      }
      case "start_questions": {
        if (ep.pitchPhase !== "PRESENTING") {
          return NextResponse.json({ message: "Must be presenting to start questions" }, { status: 400 });
        }
        await prisma.eventProject.update({
          where: { id: eventProjectId },
          data: { pitchPhase: "QUESTIONS", questionsStartedAt: now },
        });
        break;
      }
      case "finish": {
        if (ep.pitchPhase !== "QUESTIONS") {
          return NextResponse.json({ message: "Must be in questions to finish" }, { status: 400 });
        }
        await prisma.eventProject.update({
          where: { id: eventProjectId },
          data: { pitchPhase: "COMPLETED", completedAt: now },
        });
        break;
      }
      default:
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PITCH_TIMER_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
