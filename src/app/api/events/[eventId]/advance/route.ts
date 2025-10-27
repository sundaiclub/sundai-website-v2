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
      include: { mcs: { select: { hackerId: true } }, projects: true },
    });
    if (!event) return new NextResponse("Event not found", { status: 404 });

    const isMC = event.mcs.some(m => m.hackerId === me.id);
    const isAdmin = me.role === "ADMIN";
    if (!(isMC || isAdmin)) return new NextResponse("Unauthorized", { status: 401 });

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
      await prisma.eventProject.update({ where: { id: ordered[currentIdx].id }, data: { status: 'DONE' } });
    }
    if (nextIdx !== -1) {
      await prisma.eventProject.update({ where: { id: ordered[nextIdx].id }, data: { status: 'CURRENT', approved: true } });
    }
    const updated = await prisma.event.findUnique({ where: { id: params.eventId }, include: { projects: { orderBy: { position: 'asc' } } } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EVENT_ADVANCE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


