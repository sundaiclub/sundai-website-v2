import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    const submission = await prisma.submission.findUnique({
      where: {
        id: params.submissionId,
      },
      include: {
        thumbnail: {
          select: {
            url: true,
            alt: true,
            width: true,
            height: true,
          },
        },
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
        weeks: true,
      },
    });

    if (!submission) {
      return new NextResponse("Submission not found", { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[SUBMISSION_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the user making the request
    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get the submission
    const submission = await prisma.submission.findUnique({
      where: { id: params.submissionId },
      include: {
        launchLead: true,
        participants: {
          include: { hacker: true },
        },
      },
    });

    if (!submission) {
      return new NextResponse("Submission not found", { status: 404 });
    }

    // Check if user has permission to delete
    const canDelete =
      user.role === "ADMIN" || submission.launchLeadId === user.id;

    if (!canDelete) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Delete the submission
    await prisma.submission.delete({
      where: { id: params.submissionId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[SUBMISSION_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
