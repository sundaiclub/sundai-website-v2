import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const preview = formData.get("preview") as string;
    const description = formData.get("description") as string;
    const githubUrl = formData.get("githubUrl") as string;
    const demoUrl = formData.get("demoUrl") as string;
    const launchLeadId = formData.get("launchLeadId") as string;
    const participantsJson = formData.get("participants") as string;
    const participants = participantsJson ? JSON.parse(participantsJson) : [];

    const submission = await prisma.submission.findUnique({
      where: { id: params.submissionId },
      include: {
        participants: {
          include: { hacker: true },
        },
        launchLead: true,
      },
    });

    if (!submission) {
      return new NextResponse("Submission not found", { status: 404 });
    }

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    const isLaunchLead = submission.launchLeadId === user.id;
    const canEdit = isAdmin || isLaunchLead;

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Prepare the update data
    const updateData: any = {
      title,
      preview,
      description,
      githubUrl,
      demoUrl,
    };

    // Update launch lead if provided and user is admin
    if (launchLeadId && isAdmin) {
      updateData.launchLead = {
        connect: { id: launchLeadId },
      };
    }

    // Update participants if provided
    if (participants && Array.isArray(participants)) {
      updateData.participants = {
        deleteMany: {}, // This will delete all existing participants
        create: participants.map((p: any) => ({
          hackerId: p.hacker?.id || p.hackerId, // Handle both data structures
          role: p.role || "MEMBER", // Default to MEMBER if role is not provided
        })),
      };
    }

    // Update the submission with all changes in a single transaction
    const updatedSubmission = await prisma.submission.update({
      where: { id: params.submissionId },
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

    return NextResponse.json(updatedSubmission);
  } catch (error) {
    console.error("[SUBMISSION_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
