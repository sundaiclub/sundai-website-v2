import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { uploadToGCS } from "@/lib/gcp-storage";

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

    const formData = await req.formData();
    const updateData: any = {};

    const title = formData.get('title');
    if (title) updateData.title = title.toString();
    
    const preview = formData.get('preview');
    if (preview) updateData.preview = preview.toString();
    
    const description = formData.get('description');
    if (description) updateData.description = description.toString();
    
    const status = formData.get('status');
    if (status) updateData.status = status.toString();
    
    const startDate = formData.get('startDate');
    if (startDate) updateData.startDate = new Date(startDate.toString());
    
    const endDate = formData.get('endDate');
    if (endDate) updateData.endDate = new Date(endDate.toString());

    updateData.githubUrl = formData.get('githubUrl')?.toString() || null;
    updateData.demoUrl = formData.get('demoUrl')?.toString() || null;
    updateData.blogUrl = formData.get('blogUrl')?.toString() || null;

    const isStarred = formData.get('is_starred');
    if (isStarred !== null) updateData.is_starred = isStarred === 'true';
    
    const isBroken = formData.get('is_broken');
    if (isBroken !== null) updateData.is_broken = isBroken === 'true';

    const techTags = formData.getAll('techTags[]');
    if (techTags.length > 0) {
      updateData.techTags = {
        set: [],
        connect: techTags.map((id) => ({ id: id.toString() })),
      };
    }

    const domainTags = formData.getAll('domainTags[]');
    if (domainTags.length > 0) {
      updateData.domainTags = {
        set: [],
        connect: domainTags.map((id) => ({ id: id.toString() })),
      };
    }

    const thumbnail = formData.get('thumbnail') as File | null;
    if (thumbnail && thumbnail instanceof File) {
      try {
        const uploadResult = await uploadToGCS(thumbnail);
        
        const newImage = await prisma.image.create({
          data: {
            key: uploadResult.filename,
            bucket: process.env.GOOGLE_CLOUD_BUCKET!,
            url: uploadResult.url,
            filename: thumbnail.name,
            mimeType: thumbnail.type || "application/octet-stream",
            size: thumbnail.size,
            width: undefined,
            height: undefined,
            alt: title?.toString() || '',
            description: description?.toString() || '',
          },
        });

        updateData.thumbnail = {
          connect: { id: newImage.id }
        };
      } catch (error) {
        console.error("Error uploading thumbnail:", error);
        return new NextResponse("Error uploading thumbnail", { status: 500 });
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: updateData,
      include: {
        thumbnail: true,
        techTags: true,
        domainTags: true,
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
