import { ProjectStatus } from "@prisma/client";
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const ignoredDomainTags = (process.env.IGNORE_DOMAIN_TAGS || "").split(",").map(tag => tag.trim());

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          status ? { status: status as ProjectStatus } : {},
          {
            domainTags: {
              none: {
                name: {
                  in: ignoredDomainTags,
                },
              },
            },
          },
        ],
      },
      skip,
      take: limit,
      include: {
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
        techTags: true,
        domainTags: true,
        thumbnail: true,
        likes: true,
      },
    });

    const total = await prisma.project.count({
      where: {
        AND: [
          status ? { status: status as ProjectStatus } : {},
          {
            domainTags: {
              none: {
                name: {
                  in: ignoredDomainTags,
                },
              },
            },
          },
        ],
      },
    });

    const pageCount = Math.ceil(total / limit);

    return NextResponse.json({
      items: projects,
      page,
      pageCount,
      total,
    });
  } catch (error) {
    console.error("[PROJECTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
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
    const preview = formData.get("preview") as string;
    const members = JSON.parse(formData.get("members") as string);

    if (!title) {
      return NextResponse.json({
        message: "Title is required"
      }, { status: 400 });
    }

    if (!preview) {
      return NextResponse.json({
        message: "Preview is required"
      }, { status: 400 });
    }

    if (preview.length > 100) {
      return NextResponse.json({
        message: "Preview must be 100 characters or less"
      }, { status: 400 });
    }

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Builder not found", { status: 404 });
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
      const startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

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

    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    const project = await prisma.project.create({
      data: {
        title,
        preview,
        launchLeadId: hacker.id,
        status: "DRAFT",
        hack_type,
        is_broken: false,
        is_starred: false,
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
