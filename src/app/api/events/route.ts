import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startTime: "asc" },
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
            // include scalar fields like addedById by default
          },
        },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("[EVENTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (user?.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { title, description, startTime, meetingUrl, location, mcIds = [], audienceCanReorder = true } = body || {};
    if (!title || !startTime) {
      return NextResponse.json({ message: "title and startTime are required" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startTime: new Date(startTime),
        meetingUrl: meetingUrl || null,
        location: location || null,
        createdById: user.id,
        audienceCanReorder,
        mcs: {
          create: mcIds.map((hackerId: string) => ({ hackerId })),
        },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("[EVENTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


