import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Join queue by adding one of user's projects
export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({ where: { clerkId: userId } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const body = await req.json();
    const { projectId } = body || {};
    if (!projectId) return NextResponse.json({ message: "projectId required" }, { status: 400 });

    const event = await prisma.event.findUnique({ where: { id: params.eventId } });
    if (!event) return new NextResponse("Event not found", { status: 404 });

    // Verify the user owns or participates in the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        participants: { include: { hacker: true } },
      },
    });
    if (!project) return new NextResponse("Project not found", { status: 404 });

    const isOwnerOrParticipant =
      project.launchLeadId === user.id ||
      project.participants.some((p) => p.hacker.id === user.id);

    if (!isOwnerOrParticipant) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Prevent duplicates
    const existing = await prisma.eventProject.findUnique({
      where: { eventId_projectId: { eventId: params.eventId, projectId } },
      select: { id: true },
    }).catch(() => null);
    if (existing) {
      return NextResponse.json({ message: "Project already in queue" }, { status: 409 });
    }

    const last = await prisma.eventProject.findFirst({
      where: { eventId: params.eventId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPos = (last?.position || 0) + 1;

    const item = await prisma.eventProject.create({
      data: {
        eventId: params.eventId,
        projectId,
        addedById: user.id,
        position: nextPos,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("[QUEUE_JOIN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Reorder queue: accepts array of { id, position }. Admins or audience based on flag
export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const hacker = await prisma.hacker.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
    if (!hacker) return new NextResponse("User not found", { status: 404 });

    const event = await prisma.event.findUnique({ where: { id: params.eventId } });
    if (!event) return new NextResponse("Event not found", { status: 404 });

    const isAdmin = hacker.role === "ADMIN";
    const allowAll = event.audienceCanReorder || isAdmin;

    const { items } = await req.json();
    if (!Array.isArray(items)) return NextResponse.json({ message: "items array required" }, { status: 400 });

    if (!allowAll) {
      if (items.length === 0) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      // Owners can only move their own items and not before the CURRENT item
      const ids = items.map((it: { id: string }) => it.id);
      const eps = await prisma.eventProject.findMany({
        where: { id: { in: ids } },
        select: { id: true, addedById: true, eventId: true },
      });
      if (eps.length !== ids.length) return new NextResponse("Not found", { status: 404 });
      if (eps.some(ep => ep.eventId !== params.eventId)) return new NextResponse("Bad Request", { status: 400 });
      if (eps.some(ep => ep.addedById !== hacker.id)) return new NextResponse("Unauthorized", { status: 401 });

      const current = await prisma.eventProject.findFirst({ where: { eventId: params.eventId, status: 'CURRENT' }, select: { position: true } });
      if (current) {
        const invalid = items.some((it: { position: number }) => it.position <= current.position);
        if (invalid) return new NextResponse("Cannot move before current", { status: 400 });
      }
    }

    const ops = items.map((it: { id: string; position: number }) =>
      prisma.eventProject.update({ where: { id: it.id }, data: { position: it.position } })
    );
    await prisma.$transaction(ops);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[QUEUE_REORDER_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


