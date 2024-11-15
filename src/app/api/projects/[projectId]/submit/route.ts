import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

    const body = await req.json();
    const { status } = body;

    // Get the current user's hacker record
    const currentUser = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get the project and its participants
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        participants: {
          select: { hackerId: true },
        },
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    // Check if user is admin, launch lead, or team member
    const isAdmin = currentUser.role === "ADMIN";
    const isLaunchLead = project.launchLeadId === currentUser.id;
    const isTeamMember = project.participants.some(p => p.hackerId === currentUser.id);

    if (!isAdmin && !isLaunchLead && !isTeamMember) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // TODO: eventualy allow only admins to submit projects
    // Only allow transition from DRAFT to PENDING for non-admin users
    // if (!isAdmin && (project.status !== "DRAFT" || status !== "PENDING")) {
    //   return new NextResponse("Invalid status transition", { status: 400 });
    // }

    const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: { status },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("[PROJECT_STATUS_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
