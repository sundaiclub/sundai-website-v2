import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.log(userId);
    // Get the hacker using discordId (which stores Clerk userId)
    const hacker = await prisma.hacker.findUnique({
      where: { id: userId },
    });

    console.log(hacker);
    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Create like using hacker.id
    const like = await prisma.projectLike.create({
      data: {
        projectId: params.projectId,
        hackerId: hacker.id, // Use hacker.id instead of userId
      },
    });

    return NextResponse.json(like);
  } catch (error) {
    console.error("[PROJECT_LIKE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the hacker using discordId
    const hacker = await prisma.hacker.findUnique({
      where: { id: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Delete like using hacker.id
    await prisma.projectLike.delete({
      where: {
        projectId_hackerId: {
          projectId: params.projectId,
          hackerId: hacker.id, // Use hacker.id instead of userId
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PROJECT_UNLIKE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
