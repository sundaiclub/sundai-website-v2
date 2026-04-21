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
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const isAdmin = user.role === "ADMIN";
    const isMC = await prisma.eventMC.findFirst({
      where: { eventId: params.eventId, hackerId: user.id },
    });
    if (!isAdmin && !isMC) return new NextResponse("Unauthorized", { status: 401 });

    const existingEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        phase: true,
        topPresentingSec: true,
        topQuestionsSec: true,
        defaultPresentingSec: true,
        defaultQuestionsSec: true,
      },
    });
    if (!existingEvent) return new NextResponse("Not Found", { status: 404 });

    const body = await req.json();
    const { title, startTime, meetingUrl, mcIds, votingEndTime, topProjectCount, topPresentingSec, topQuestionsSec, defaultPresentingSec, defaultQuestionsSec } = body;

    const nextTopPresentingSec = topPresentingSec ?? existingEvent.topPresentingSec;
    const nextTopQuestionsSec = topQuestionsSec ?? existingEvent.topQuestionsSec;
    const nextDefaultPresentingSec = defaultPresentingSec ?? existingEvent.defaultPresentingSec;
    const nextDefaultQuestionsSec = defaultQuestionsSec ?? existingEvent.defaultQuestionsSec;
    const timingConfigChanged =
      topPresentingSec !== undefined ||
      topQuestionsSec !== undefined ||
      defaultPresentingSec !== undefined ||
      defaultQuestionsSec !== undefined;

    const eventUpdate = prisma.event.update({
      where: { id: params.eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }),
        ...(votingEndTime !== undefined && { votingEndTime: votingEndTime ? new Date(votingEndTime) : null }),
        ...(topProjectCount !== undefined && { topProjectCount }),
        ...(topPresentingSec !== undefined && { topPresentingSec }),
        ...(topQuestionsSec !== undefined && { topQuestionsSec }),
        ...(defaultPresentingSec !== undefined && { defaultPresentingSec }),
        ...(defaultQuestionsSec !== undefined && { defaultQuestionsSec }),
      },
    });

    if (timingConfigChanged && existingEvent.phase === "PITCHING") {
      await prisma.$transaction([
        eventUpdate,
        prisma.eventProject.updateMany({
          where: {
            eventId: params.eventId,
            isTopProject: true,
            status: { in: ["CURRENT", "APPROVED"] },
          },
          data: {
            allottedPresentingSec: nextTopPresentingSec,
            allottedQuestionsSec: nextTopQuestionsSec,
          },
        }),
        prisma.eventProject.updateMany({
          where: {
            eventId: params.eventId,
            isTopProject: false,
            status: { in: ["CURRENT", "APPROVED"] },
          },
          data: {
            allottedPresentingSec: nextDefaultPresentingSec,
            allottedQuestionsSec: nextDefaultQuestionsSec,
          },
        }),
      ]);
    } else {
      await eventUpdate;
    }

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
