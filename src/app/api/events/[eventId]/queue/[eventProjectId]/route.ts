import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Delist (remove) an item from the queue
export async function DELETE(
  req: Request,
  { params }: { params: { eventId: string; eventProjectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.hacker.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
    if (!me) return new NextResponse("User not found", { status: 404 });

    const ep = await prisma.eventProject.findUnique({ where: { id: params.eventProjectId } });
    if (!ep || ep.eventId !== params.eventId) return new NextResponse("Not found", { status: 404 });

    // Permissions: MC/Admin can delist any; owner (addedBy) can delist their own item unless it's CURRENT
    const event = await prisma.event.findUnique({ where: { id: params.eventId }, include: { mcs: true } });
    const isMC = !!event?.mcs.find(m => m.hackerId === me.id);
    const isAdmin = me.role === 'ADMIN';
    const isOwner = ep.addedById === me.id;

    if (!(isAdmin || isMC || (isOwner && ep.status !== 'CURRENT'))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await prisma.eventProject.delete({ where: { id: params.eventProjectId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[QUEUE_ITEM_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


