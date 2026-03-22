import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (user?.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { meetingUrl, mcIds } = body;

    await prisma.event.update({
      where: { id: params.eventId },
      data: {
        ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }),
      },
    });

    if (mcIds !== undefined) {
      await prisma.eventMC.deleteMany({ where: { eventId: params.eventId } });
      if (mcIds.length > 0) {
        await prisma.eventMC.createMany({
          data: mcIds.map((hackerId: string) => ({
            eventId: params.eventId,
            hackerId,
          })),
        });
      }
    }

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

    return NextResponse.json(event);
  } catch (error) {
    console.error("[EVENT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
