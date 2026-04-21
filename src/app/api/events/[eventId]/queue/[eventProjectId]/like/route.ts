import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

async function getAuthorizedHacker() {
  const { userId: clerkId } = auth();
  if (!clerkId) {
    return { error: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const hacker = await prisma.hacker.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!hacker) {
    return { error: new NextResponse("Hacker not found", { status: 404 }) };
  }

  return { hacker };
}

async function getVotingEventProject(eventId: string, eventProjectId: string) {
  const eventProject = await prisma.eventProject.findUnique({
    where: { id: eventProjectId },
    select: {
      id: true,
      eventId: true,
      projectId: true,
      event: {
        select: {
          phase: true,
        },
      },
    },
  });

  if (!eventProject || eventProject.eventId !== eventId) {
    return {
      error: NextResponse.json({ message: "Event project not found" }, { status: 404 }),
    };
  }

  if (eventProject.event.phase !== "VOTING") {
    return {
      error: NextResponse.json(
        { message: "Pitch likes can only be changed during voting" },
        { status: 400 }
      ),
    };
  }

  return { eventProject };
}

export async function POST(
  req: Request,
  { params }: { params: { eventId: string; eventProjectId: string } }
) {
  try {
    const authResult = await getAuthorizedHacker();
    if (authResult.error) return authResult.error;

    const eventProjectResult = await getVotingEventProject(
      params.eventId,
      params.eventProjectId
    );
    if (eventProjectResult.error) return eventProjectResult.error;

    const { hacker } = authResult;
    const { eventProject } = eventProjectResult;

    const [, pitchLike] = await prisma.$transaction([
      prisma.projectLike.upsert({
        where: {
          projectId_hackerId: {
            projectId: eventProject.projectId,
            hackerId: hacker.id,
          },
        },
        create: {
          projectId: eventProject.projectId,
          hackerId: hacker.id,
        },
        update: {},
      }),
      prisma.eventProjectLike.upsert({
        where: {
          eventProjectId_hackerId: {
            eventProjectId: eventProject.id,
            hackerId: hacker.id,
          },
        },
        create: {
          eventProjectId: eventProject.id,
          hackerId: hacker.id,
        },
        update: {},
      }),
    ]);

    return NextResponse.json(pitchLike);
  } catch (error) {
    console.error("[EVENT_PROJECT_LIKE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { eventId: string; eventProjectId: string } }
) {
  try {
    const authResult = await getAuthorizedHacker();
    if (authResult.error) return authResult.error;

    const eventProjectResult = await getVotingEventProject(
      params.eventId,
      params.eventProjectId
    );
    if (eventProjectResult.error) return eventProjectResult.error;

    const { hacker } = authResult;
    const { eventProject } = eventProjectResult;

    await prisma.eventProjectLike.deleteMany({
      where: {
        eventProjectId: eventProject.id,
        hackerId: hacker.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EVENT_PROJECT_LIKE_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
