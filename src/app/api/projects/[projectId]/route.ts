import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
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
        likes: {
          select: {
            hackerId: true,
            createdAt: true,
          },
        },
        techTags: true,
        domainTags: true,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    return NextResponse.json({
      ...project,
      likes: project.likes.map((like) => ({
        hackerId: like.hackerId,
        createdAt: like.createdAt,
      })),
    });
  } catch (error) {
    console.error("[PROJECT_GET]", error);
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

    // Get the hacker making the request
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Get the project to check ownership
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        likes: true,
        participants: true,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    // Check if user is admin or launch lead
    const isAdmin = hacker.role === "ADMIN";
    const isLaunchLead = project.launchLeadId === hacker.id;

    if (!isAdmin && !isLaunchLead) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Delete related records first
    await prisma.$transaction([
      // Delete likes
      prisma.projectLike.deleteMany({
        where: { projectId: params.projectId },
      }),
      // Delete participants
      prisma.projectToParticipant.deleteMany({
        where: { projectId: params.projectId },
      }),
      // Finally delete the project
      prisma.project.delete({
        where: { id: params.projectId },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PROJECT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
