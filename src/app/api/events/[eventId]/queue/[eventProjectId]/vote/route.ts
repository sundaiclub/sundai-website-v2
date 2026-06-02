import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const VOTE_VALUES = new Set(["LIKE", "DISLIKE"]);

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

async function getActiveEventProject(eventId: string, eventProjectId: string) {
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

  if (eventProject.event.phase === "FINISHED") {
    return {
      error: NextResponse.json(
        { message: "Pitch votes can only be changed while the event is active" },
        { status: 400 }
      ),
    };
  }

  return { eventProject };
}

export async function PUT(
  req: Request,
  { params }: { params: { eventId: string; eventProjectId: string } }
) {
  try {
    const authResult = await getAuthorizedHacker();
    if (authResult.error) return authResult.error;

    const eventProjectResult = await getActiveEventProject(
      params.eventId,
      params.eventProjectId
    );
    if (eventProjectResult.error) return eventProjectResult.error;

    const body = await req.json().catch(() => ({}));
    const value = body?.value;
    if (!VOTE_VALUES.has(value)) {
      return NextResponse.json({ message: "value must be LIKE or DISLIKE" }, { status: 400 });
    }

    const { hacker } = authResult;
    const { eventProject } = eventProjectResult;

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (value === "LIKE") {
      operations.push(
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
        })
      );
    }

    operations.push(
      prisma.eventProjectVote.upsert({
        where: {
          eventProjectId_hackerId: {
            eventProjectId: eventProject.id,
            hackerId: hacker.id,
          },
        },
        create: {
          eventProjectId: eventProject.id,
          hackerId: hacker.id,
          value,
        },
        update: {
          value,
        },
      })
    );

    const results = await prisma.$transaction(operations);
    const vote = results[results.length - 1];

    return NextResponse.json(vote);
  } catch (error) {
    console.error("[EVENT_PROJECT_VOTE_PUT]", error);
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

    const eventProjectResult = await getActiveEventProject(
      params.eventId,
      params.eventProjectId
    );
    if (eventProjectResult.error) return eventProjectResult.error;

    const { hacker } = authResult;
    const { eventProject } = eventProjectResult;

    await prisma.eventProjectVote.deleteMany({
      where: {
        eventProjectId: eventProject.id,
        hackerId: hacker.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EVENT_PROJECT_VOTE_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
