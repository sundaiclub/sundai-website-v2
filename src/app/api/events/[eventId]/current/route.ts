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

    const me = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
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
      return NextResponse.json(
        { message: "Can only choose the current project during PITCHING" },
        { status: 400 }
      );
    }

    const { eventProjectId } = await req.json().catch(() => ({}));
    if (!eventProjectId) {
      return NextResponse.json(
        { message: "eventProjectId is required" },
        { status: 400 }
      );
    }

    const ordered = await prisma.eventProject.findMany({
      where: { eventId: params.eventId },
      orderBy: { position: "asc" },
    });

    const target = ordered.find(ep => ep.id === eventProjectId);
    if (!target) {
      return new NextResponse("EventProject not found", { status: 404 });
    }

    const existingCurrent = ordered.find(ep => ep.status === "CURRENT");

    const ops: Array<ReturnType<typeof prisma.eventProject.update>> = [];

    if (existingCurrent && existingCurrent.id !== target.id) {
      ops.push(
        prisma.eventProject.update({
          where: { id: existingCurrent.id },
          data: {
            status: "APPROVED",
            approved: true,
            pitchPhase: "WAITING",
            presentingStartedAt: null,
            questionsStartedAt: null,
            completedAt: null,
          },
        })
      );
    }

    ops.push(
      prisma.eventProject.update({
        where: { id: target.id },
        data: {
          status: "CURRENT",
          approved: true,
          pitchPhase: "WAITING",
          presentingStartedAt: null,
          questionsStartedAt: null,
          completedAt: null,
        },
      })
    );

    await prisma.$transaction(ops);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EVENT_CURRENT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
