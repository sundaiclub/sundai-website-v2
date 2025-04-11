import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

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

    const isAdmin = user?.role === "ADMIN";
    const canEdit = 
      isAdmin ||
      project.launchLeadId === user?.id ||
      project.participants.some(p => p.hacker.id === user?.id);

    if (!canEdit) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const updateData: any = {};

    const newStatus = formData.get('status');
    if (newStatus) {
      const currentStatus = project.status;
      
      if (newStatus === "APPROVED" && !isAdmin) {
        return new NextResponse("Only admins can approve projects", { status: 403 });
      }
      
      if (!isAdmin && currentStatus === "PENDING" && newStatus !== "PENDING") {
        return new NextResponse("Only admins can change status of pending projects", { status: 403 });
      }

      updateData.status = newStatus.toString();
    }

    const isStarred = formData.get('is_starred');
    if (isStarred !== null && !isAdmin) {
      return new NextResponse("Only admins can change starred status", { status: 403 });
    } else if (isStarred !== null) {
      updateData.is_starred = isStarred === 'true';
    }

    const title = formData.get('title');
    if (title) updateData.title = title.toString();
    
    const preview = formData.get('preview');
    if (preview) updateData.preview = preview.toString();
    
    const description = formData.get('description');
    if (description) updateData.description = description.toString();
    
    const startDate = formData.get('startDate');
    if (startDate) updateData.startDate = new Date(startDate.toString());
    
    const endDate = formData.get('endDate');
    if (endDate) updateData.endDate = new Date(endDate.toString());

    updateData.githubUrl = formData.get('githubUrl')?.toString() || null;
    updateData.demoUrl = formData.get('demoUrl')?.toString() || null;
    updateData.blogUrl = formData.get('blogUrl')?.toString() || null;
    
    const isBroken = formData.get('is_broken');
    if (isBroken !== null) updateData.is_broken = isBroken === 'true';

    const techTags = formData.getAll('techTags[]');
    updateData.techTags = {
      set: techTags.map((id) => ({ id: id.toString() }))
    };

    const domainTags = formData.getAll('domainTags[]');
    updateData.domainTags = {
      set: domainTags.map((id) => ({ id: id.toString() }))
    };

    const deleteThumbnail = formData.get('deleteThumbnail') === 'true';
    const thumbnail = formData.get('thumbnail');

    if (deleteThumbnail) {
      updateData.thumbnail = {
        disconnect: true
      };
    } else if (thumbnail && typeof thumbnail !== 'string') {
      if ('size' in thumbnail && 'type' in thumbnail && 'name' in thumbnail) {
        try {
          let fileBuffer: Buffer | undefined;
          if (thumbnail instanceof Blob) {
            fileBuffer = Buffer.from(await thumbnail.arrayBuffer());
          }

          const uploadResult = await uploadToGCS({
            name: thumbnail.name,
            type: thumbnail.type,
            arrayBuffer: async () => fileBuffer || await thumbnail.arrayBuffer(),
          } as any);
          
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

          console.log('Created image:', {
            url: newImage.url,
            filename: newImage.filename
          });

          updateData.thumbnail = {
            connect: { id: newImage.id }
          };
        } catch (error) {
          console.error("Error uploading thumbnail:", error);
          return new NextResponse("Error uploading thumbnail", { status: 500 });
        }
      }
    }

    const canManageTeam = user?.role === "ADMIN" || project.launchLeadId === user?.id;
    
    if (canManageTeam) {
      const participantsJson = formData.get('participants');
      const launchLeadId = formData.get('launchLead');

      if (launchLeadId) {
        updateData.launchLead = {
          connect: { id: launchLeadId.toString() }
        };
      }

      if (participantsJson) {
        const participants = JSON.parse(participantsJson.toString());
        
        await prisma.projectToParticipant.deleteMany({
          where: { projectId: params.projectId }
        });

        updateData.participants = {
          create: participants
            .filter((p: any) => p.hacker.id !== launchLeadId)
            .map((p: any) => ({
              hackerId: p.hacker.id,
              role: p.role
            }))
        };
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
