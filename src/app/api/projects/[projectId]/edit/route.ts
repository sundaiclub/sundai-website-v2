import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        participants: {
          include: { hacker: true }
        },
        launchLead: true,
      }
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    const canEdit = 
      user?.role === "ADMIN" ||
      project.launchLeadId === user?.id ||
      project.participants.some(p => p.hacker.id === user?.id);

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const updateData = {};

    if (body.title) updateData.title = body.title;
    if (body.preview) updateData.preview = body.preview;
    if (body.description) updateData.description = body.description;
    if (body.githubUrl) updateData.githubUrl = body.githubUrl;
    if (body.demoUrl) updateData.demoUrl = body.demoUrl;
    if (body.blogUrl) updateData.blogUrl = body.blogUrl;
    if (body.status) updateData.status = body.status;
    if (body.is_starred !== undefined) updateData.is_starred = body.is_starred;
    if (body.is_broken !== undefined) updateData.is_broken = body.is_broken;
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);

    const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: updateData,
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

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("[PROJECT_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
