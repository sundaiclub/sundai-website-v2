// import { ProjectStatus } from "@prisma/client";
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
// import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');

  const search = searchParams.get('search') || undefined;
  const fromDate = searchParams.get('from_date') || undefined;
  const toDate = searchParams.get('to_date') || undefined;
  const sort = searchParams.get('sort') || undefined;
  const starred = searchParams.get('starred') === '1';

  const status = searchParams.getAll('status'); // can be []
  const techTags = searchParams.getAll('tech_tag'); // can be []
  const domainTags = searchParams.getAll('domain_tag'); // can be []

  // WHERE
  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { preview: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  if (starred) {
    where.is_starred = true;
  }

  if (fromDate || toDate) {
    where.startDate = {};
    if (fromDate) {
      where.startDate.gte = new Date(fromDate);
    }
    if (toDate) {
      // end of day
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      where.startDate.lte = to;
    }
  }

  if (techTags && techTags.length > 0) {
    // assumes project.techTags is M:N
    where.techTags = {
      some: {
        name: { in: techTags },
      },
    };
  }

  if (domainTags && domainTags.length > 0) {
    where.domainTags = {
      some: {
        name: { in: domainTags },
      },
    };
  }

  // SORT
  // map frontend values -> prisma orderBy
  let orderBy: any = { createdAt: 'desc' }; // default

  switch (sort) {
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'updated':
      orderBy = { updatedAt: 'desc' };
      break;
    case 'alpha':
      orderBy = { title: 'asc' };
      break;
    case 'likes':
      // order by count of likes desc, then createdAt desc
      orderBy = [
        { likes: { _count: 'desc' } },
        { createdAt: 'desc' },
      ];
      break;
    case 'trending':
      // you can define trending however you want, for now: recently updated + likes
      orderBy = [
        { updatedAt: 'desc' },
        { likes: { _count: 'desc' } },
      ];
      break;
    default:
      // if sort is not provided, leave default
      break;
  }

  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        launchLead: true,
        participants: {
          include: {
            hacker: true,
          },
        },
        techTags: true,
        domainTags: true,
        likes: true,
      },
    }),
  ]);

  const pageCount = Math.ceil(total / limit);

  return NextResponse.json({
    items,
    page,
    pageCount,
    total,
  });
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
