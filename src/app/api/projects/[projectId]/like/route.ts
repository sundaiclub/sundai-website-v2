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

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Check if like already exists
    const existingLike = await prisma.projectLike.findUnique({
      where: {
        projectId_hackerId: {
          projectId: params.projectId,
          hackerId: hacker.id,
        },
      },
    });

    if (existingLike) {
      return NextResponse.json(existingLike);
    }

    // Create new like if it doesn't exist
    const like = await prisma.projectLike.create({
      data: {
        projectId: params.projectId,
        hackerId: hacker.id,
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

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Delete like using hacker.id
    await prisma.projectLike.delete({
      where: {
        projectId_hackerId: {
          projectId: params.projectId,
          hackerId: hacker.id,
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PROJECT_UNLIKE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
