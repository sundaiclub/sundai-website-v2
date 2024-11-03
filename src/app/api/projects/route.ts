import { PrismaClient, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const projects = await prisma.project.findMany({
      where: status ? { status: status as ProjectStatus } : undefined,
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
      },
      orderBy: [
        {
          status: status === "PENDING" ? "asc" : "desc", // This will put APPROVED first when not filtering
        },
        {
          createdAt: "desc", // Most recent first within each status group
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
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const githubUrl = formData.get("githubUrl") as string;
    const demoUrl = formData.get("demoUrl") as string;
    const launchLeadId = formData.get("launchLeadId") as string;
    const members = JSON.parse(formData.get("members") as string);
    const thumbnail = formData.get("thumbnail") as File;

    if (!title || !description || !launchLeadId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    let thumbnailUrl = null;
    let thumbnailKey = null;

    if (thumbnail) {
      // const fileBuffer = await thumbnail.arrayBuffer();
      // const fileName = `projects/${Date.now()}-${thumbnail.name}`;
      // const file = bucket.file(fileName);
      // await file.save(Buffer.from(fileBuffer), {
      //   metadata: {
      //     contentType: thumbnail.type,
      //   },
      // });
      // thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      // thumbnailKey = fileName;
    }

    // // Create image record if thumbnail exists
    // let thumbnailImage = null;
    // if (thumbnailUrl && thumbnailKey) {
    //   thumbnailImage = await prisma.image.create({
    //     data: {
    //       key: thumbnailKey,
    //       bucket: bucket.name,
    //       url: thumbnailUrl,
    //       filename: thumbnail.name,
    //       mimeType: thumbnail.type,
    //       size: thumbnail.size,
    //     },
    //   });
    // }

    // Create project with participants and thumbnail
    const project = await prisma.project.create({
      data: {
        title,
        description,
        githubUrl,
        demoUrl,
        launchLeadId,
        status: "PENDING",
        // thumbnailId: thumbnailImage?.id,
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
