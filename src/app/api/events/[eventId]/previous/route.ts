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

    const ordered = await prisma.eventProject.findMany({
      where: { eventId: params.eventId },
      orderBy: { position: 'asc' },
    });
    const currentIdx = ordered.findIndex(p => p.status === 'CURRENT');

    if (currentIdx === -1) {
      // No current: prefer last DONE/SKIPPED; if none, pick last APPROVED/QUEUED
      let targetIdx = -1;
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (ordered[i].status === 'DONE' || ordered[i].status === 'SKIPPED') { targetIdx = i; break; }
      }
      if (targetIdx === -1) {
        for (let i = ordered.length - 1; i >= 0; i--) {
          if (ordered[i].status === 'APPROVED' || ordered[i].status === 'QUEUED') { targetIdx = i; break; }
        }
      }
      if (targetIdx === -1) return new NextResponse(null, { status: 204 });
      await prisma.eventProject.update({ where: { id: ordered[targetIdx].id }, data: { status: 'CURRENT' } });
    } else {
      // Find nearest previous item (DONE/SKIPPED/APPROVED/QUEUED) and make it CURRENT
      let prevIdx = -1;
      for (let i = currentIdx - 1; i >= 0; i--) {
        const st = ordered[i].status as string;
        if (st === 'DONE' || st === 'SKIPPED' || st === 'APPROVED' || st === 'QUEUED') { prevIdx = i; break; }
      }
      if (prevIdx === -1) return new NextResponse(null, { status: 204 });
      await prisma.$transaction([
        prisma.eventProject.update({ where: { id: ordered[currentIdx].id }, data: { status: 'APPROVED' } }),
        prisma.eventProject.update({ where: { id: ordered[prevIdx].id }, data: { status: 'CURRENT', approved: true } }),
      ]);
    }

    const updated = await prisma.event.findUnique({ where: { id: params.eventId }, include: { projects: { orderBy: { position: 'asc' } } } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EVENT_PREVIOUS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


