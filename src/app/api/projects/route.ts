import { ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy");
    const timeFilter = searchParams.get("timeFilter");

    // Determine hack_type based on environment
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    // Build date filter based on timeFilter parameter
    let dateFilter = {};
    if (timeFilter) {
      const now = new Date();
      let startDate = new Date();
      
      switch (timeFilter) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'year':
          startDate.setDate(now.getDate() - 365);
          break;
        default:
          // No date filter
          break;
      }
      
      if (timeFilter !== 'all') {
        dateFilter = {
          createdAt: {
            gte: startDate,
          },
        };
      }
    }

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          status ? { status: status as ProjectStatus } : {},
          { hack_type },
          dateFilter
        ]
      },
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
        techTags: true,
        domainTags: true,
        likes: {
          select: {
            hackerId: true,
            createdAt: true,
          },
        },
      },
      orderBy: sortBy === 'likes' ? [
        {
          createdAt: "desc",
        },
      ] : [
        {
          status: status === "PENDING" ? "asc" : "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    // Calculate likes per day metric and sort
    const now = new Date();
    const projectsWithMetric = projects.map(project => {
      const createdAt = new Date(project.createdAt);
      const daysSinceCreation = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
      const likeCount = project.likes.length;
      const likesPerDay = likeCount / daysSinceCreation;
      
      return {
        ...project,
        likesPerDay,
        daysSinceCreation
      };
    });

    // Sort by likes per day (descending), then by creation date (descending)
    const sortedProjects = projectsWithMetric.sort((a, b) => {
      if (a.likesPerDay !== b.likesPerDay) {
        return b.likesPerDay - a.likesPerDay; // Descending order
      }
      // If likes per day is equal, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(
      sortedProjects.map((project) => ({
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

    // Determine hack_type based on environment
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    // Create project with participants and thumbnail
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
