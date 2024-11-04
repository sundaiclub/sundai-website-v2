import { PrismaClient, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const projects = await prisma.project.findMany({
      where: status ? { status: status as ProjectStatus } : undefined,
      include: {
        thumbnail: {
          select: {
            url: true,
            alt: true,
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
      },
      orderBy: [
        {
          status: status === "PENDING" ? "asc" : "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return NextResponse.json(
      projects.map((project) => ({
        ...project,
        likes: project.likes.map((like) => ({
          hackerId: like.hackerId,
          createdAt: like.createdAt,
        })),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Error fetching projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const githubUrl = formData.get("githubUrl") as string;
    const demoUrl = formData.get("demoUrl") as string;
    const members = JSON.parse(formData.get("members") as string);
    const thumbnail = formData.get("thumbnail") as File | null;

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    if (!title || !description) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    let thumbnailImage = null;
    if (thumbnail) {
      try {
        const uploadResult = await uploadToGCS(thumbnail);

        // Create image record with all required fields
        thumbnailImage = await prisma.image.create({
          data: {
            key: uploadResult.filename,
            bucket: process.env.GOOGLE_CLOUD_BUCKET!,
            url: uploadResult.url,
            filename: thumbnail.name,
            mimeType: thumbnail.type || "application/octet-stream",
            size: thumbnail.size,
            width: undefined,
            height: undefined,
            alt: title,
            description: description,
          },
        });
      } catch (error) {
        console.error("Error uploading thumbnail:", error);
        return new NextResponse("Error uploading thumbnail", { status: 500 });
      }
    }

    // Get or create current week
    const now = new Date();
    let currentWeek = await prisma.week.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (!currentWeek) {
      // Create a new week if none exists
      const startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      // Get the latest week number
      const latestWeek = await prisma.week.findFirst({
        orderBy: { number: "desc" },
      });
      const weekNumber = (latestWeek?.number || 0) + 1;

      currentWeek = await prisma.week.create({
        data: {
          number: weekNumber,
          startDate,
          endDate,
          theme: `Week ${weekNumber}`,
          description: `Projects for week ${weekNumber}`,
        },
      });
    }

    // Create project with participants and thumbnail
    const project = await prisma.project.create({
      data: {
        title,
        description,
        githubUrl,
        demoUrl,
        launchLeadId: hacker.id,
        status: "PENDING",
        thumbnailId: thumbnailImage?.id,
        weeks: {
          connect: {
            id: currentWeek.id,
          },
        },
        participants: {
          create: members.map((member: { id: string; role: string }) => ({
            hackerId: member.id,
            role: member.role,
          })),
        },
      },
      include: {
        participants: {
          include: {
            hacker: true,
          },
        },
        thumbnail: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("[PROJECTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
