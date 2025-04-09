import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Builder not found", { status: 404 });
    }

    const { role } = await request.json();

    // Check if user is already a participant
    const existingParticipant = await prisma.projectToParticipant.findUnique({
      where: {
        hackerId_projectId: {
          hackerId: hacker.id,
          projectId: params.projectId,
        },
      },
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: "Already a participant" },
        { status: 400 }
      );
    }

    // Add user as participant
    const participant = await prisma.projectToParticipant.create({
      data: {
        hackerId: hacker.id,
        projectId: params.projectId,
        role,
      },
      include: {
        hacker: {
          include: {
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(participant);
  } catch (error) {
    console.error("[PROJECT_JOIN]", error);
    return NextResponse.json(
      { error: "Error joining project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Remove user from project
    await prisma.projectToParticipant.delete({
      where: {
        hackerId_projectId: {
          hackerId: hacker.id,
          projectId: params.projectId,
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PROJECT_LEAVE]", error);
    return NextResponse.json(
      { error: "Error leaving project" },
      { status: 500 }
    );
  }
}
