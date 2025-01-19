import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    const canEdit =
      user?.role === "ADMIN" ||
      submission.launchLeadId === user?.id ||
      submission.participants.some((p) => p.hacker.id === user?.id);

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new NextResponse("No file provided", { status: 400 });
    }

    try {
      const uploadResult = await uploadToGCS(file);

      const newImage = await prisma.image.create({
        data: {
          key: uploadResult.filename,
          bucket: process.env.GOOGLE_CLOUD_BUCKET!,
          url: uploadResult.url,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          width: undefined,
          height: undefined,
          alt: submission.title || "",
          description: submission.description || "",
        },
      });

      const updatedSubmission = await prisma.submission.update({
        where: { id: params.submissionId },
        data: {
          thumbnail: {
            connect: { id: newImage.id },
          },
        },
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
      console.error("Error uploading thumbnail:", error);
      return new NextResponse("Error uploading thumbnail", { status: 500 });
    }
  } catch (error) {
    console.error("[SUBMISSION_THUMBNAIL_UPLOAD]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
