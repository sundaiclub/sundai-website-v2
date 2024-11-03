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

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: {
        role: true,
      },
    });

    if (user?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Update project status
    const project = await prisma.project.update({
      where: { id: params.projectId },
      data: { status: "APPROVED" },
      include: {
        thumbnail: true,
        launchLead: {
          include: {
            avatar: true,
          },
        },
        participants: {
          include: {
            hacker: {
              include: {
                avatar: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("[PROJECT_APPROVE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
