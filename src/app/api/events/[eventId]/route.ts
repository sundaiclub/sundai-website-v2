import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        mcs: { include: { hacker: { include: { avatar: true } } } },
        projects: {
          orderBy: { position: "asc" },
          include: {
            project: {
              include: {
                thumbnail: true,
                launchLead: { include: { avatar: true } },
                participants: { include: { hacker: { include: { avatar: true } } } },
                techTags: true,
                domainTags: true,
                likes: { select: { hackerId: true, createdAt: true } },
              },
            },
          },
        },
      },
    });

    if (!event) return new NextResponse("Not Found", { status: 404 });

    return NextResponse.json(event);
  } catch (error) {
    console.error("[EVENT_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
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
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: { mcs: true },
    });
    if (!event) return new NextResponse("Not Found", { status: 404 });

    const isAdmin = me.role === "ADMIN";
    const isMC = !!event.mcs.find((m) => m.hackerId === me.id);
    if (!(isAdmin || isMC)) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { title, description, meetingUrl, startTime, audienceCanReorder, mcIds, isFinished } = body || {};

    const updates: any = {};
    if (typeof title === "string") updates.title = title;
    if (typeof description === "string") updates.description = description;
    if (typeof meetingUrl === "string" || meetingUrl === null) updates.meetingUrl = meetingUrl;
    if (typeof startTime === "string") updates.startTime = new Date(startTime);
    if (typeof audienceCanReorder === "boolean") updates.audienceCanReorder = audienceCanReorder;
    if (typeof isFinished === "boolean") updates.isFinished = isFinished;

    const tx: any[] = [];
    if (Object.keys(updates).length > 0) {
      tx.push(prisma.event.update({
        where: { id: params.eventId },
        data: updates,
      }));
    }

    if (Array.isArray(mcIds)) {
      const unique = Array.from(new Set(mcIds as string[]));
      // Delete MCs not in list, and add new ones
      tx.push(
        prisma.eventMC.deleteMany({
          where: { eventId: params.eventId, hackerId: { notIn: unique } },
        })
      );
      // Determine which to add
      const existing = await prisma.eventMC.findMany({
        where: { eventId: params.eventId },
        select: { hackerId: true },
      });
      const existingSet = new Set(existing.map((e) => e.hackerId));
      const toCreate = unique.filter((id) => !existingSet.has(id)).map((id) => ({ eventId: params.eventId, hackerId: id }));
      if (toCreate.length > 0) {
        tx.push(prisma.eventMC.createMany({ data: toCreate, skipDuplicates: true }));
      }
    }

    if (tx.length === 0) {
      return NextResponse.json(await prisma.event.findUnique({
        where: { id: params.eventId },
        include: {
          mcs: { include: { hacker: { include: { avatar: true } } } },
          projects: {
            orderBy: { position: "asc" },
            include: {
              project: {
                include: {
                  thumbnail: true,
                  launchLead: { include: { avatar: true } },
                  participants: { include: { hacker: { include: { avatar: true } } } },
                  techTags: true,
                  domainTags: true,
                  likes: { select: { hackerId: true, createdAt: true } },
                },
              },
            },
          },
        },
      }));
    }

    await prisma.$transaction(tx);

    const updated = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        mcs: { include: { hacker: { include: { avatar: true } } } },
        projects: {
          orderBy: { position: "asc" },
          include: {
            project: {
              include: {
                thumbnail: true,
                launchLead: { include: { avatar: true } },
                participants: { include: { hacker: { include: { avatar: true } } } },
                techTags: true,
                domainTags: true,
                likes: { select: { hackerId: true, createdAt: true } },
              },
            },
          },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EVENT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


