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

    if (event.phase === "PITCHING") {
      return NextResponse.json({ message: "Event is already in PITCHING phase" }, { status: 400 });
    }

    // Fetch all event projects with their like counts
    const eventProjects = await prisma.eventProject.findMany({
      where: { eventId: params.eventId },
      include: {
        project: {
          include: { likes: { select: { id: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Sort by like count desc, tiebreak by createdAt asc
    const sorted = [...eventProjects].sort((a, b) => {
      const likeDiff = b.project.likes.length - a.project.likes.length;
      if (likeDiff !== 0) return likeDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Determine top group threshold (top 5 by likes, including ties)
    const likeCounts = sorted.map(ep => ep.project.likes.length);
    const threshold = likeCounts.length >= 5 ? likeCounts[4] : -1;

    // Assign positions, allotted times, and update phase in a single transaction
    const ops = sorted.map((ep, idx) => {
      const isTopGroup = threshold >= 0 && ep.project.likes.length >= threshold;
      return prisma.eventProject.update({
        where: { id: ep.id },
        data: {
          position: idx + 1,
          allottedPresentingSec: isTopGroup ? 120 : 60,
          allottedQuestionsSec: isTopGroup ? 180 : 120,
        },
      });
    });

    ops.push(
      prisma.event.update({
        where: { id: params.eventId },
        data: { phase: "PITCHING" },
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
