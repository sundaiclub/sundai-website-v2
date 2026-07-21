import { HackType, Prisma, ProjectStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadToGCS } from '@/lib/gcp-storage';
import prisma from '@/lib/prisma';
import { getOrCreateCurrentWeek } from '@/lib/weeks';

const ignoredDomainTags = (process.env.IGNORE_DOMAIN_TAGS || '')
  .split(',')
  .map(tag => tag.trim())
  .filter(tag => tag.length > 0);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const shouldReturnAll = searchParams.get('all') === 'true';
    const limit = Number.parseInt(limitParam || '', 10);
    const offset = Number.parseInt(offsetParam || '', 10);
    const hasPagination =
      !shouldReturnAll && Number.isFinite(limit) && limit > 0;
    const safeLimit = hasPagination ? Math.min(limit, 50) : undefined;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

    // Determine hack_type based on environment
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type: HackType = isResearchSite
      ? HackType.RESEARCH
      : HackType.REGULAR;
    const ignoredDomainTagsFilter =
      ignoredDomainTags.length > 0
        ? ([
            {
              domainTags: {
                none: {
                  name: {
                    in: ignoredDomainTags,
                  },
                },
              },
            },
          ] satisfies Prisma.ProjectWhereInput[])
        : [];

    const projectWhere: Prisma.ProjectWhereInput = {
      AND: [
        status ? { status: status as ProjectStatus } : {},
        { hack_type },
        ...ignoredDomainTagsFilter,
      ],
    };

    const projects = await prisma.project.findMany({
      where: projectWhere,
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
      orderBy: [
        {
          status: status === 'PENDING' ? 'asc' : 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      ...(hasPagination
        ? {
            skip: safeOffset,
            take: safeLimit! + 1,
          }
        : {}),
    });

    const serializedProjects = projects.map(project => ({
      ...project,
      likes: project.likes.map(like => ({
        hackerId: like.hackerId,
        createdAt: like.createdAt,
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));

    if (hasPagination) {
      const totalCount = await prisma.project.count({
        where: projectWhere,
      });

      return NextResponse.json({
        projects: serializedProjects.slice(0, safeLimit),
        hasMore: serializedProjects.length > safeLimit!,
        totalCount,
      });
    }

    return NextResponse.json(serializedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Error fetching projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const preview = formData.get('preview') as string;
    const members = JSON.parse(formData.get('members') as string);

    if (!title) {
      return NextResponse.json(
        {
          message: 'Title is required',
        },
        { status: 400 }
      );
    }

    if (!preview) {
      return NextResponse.json(
        {
          message: 'Preview is required',
        },
        { status: 400 }
      );
    }

    if (preview.length > 100) {
      return NextResponse.json(
        {
          message: 'Preview must be 100 characters or less',
        },
        { status: 400 }
      );
    }

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse('Builder not found', { status: 404 });
    }

    const currentWeek = await getOrCreateCurrentWeek();
    const now = new Date();
    const activeEvents = await prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        startTime: { lte: now },
        endTime: { gte: now },
        OR: [
          {
            chapter: {
              memberships: {
                some: { hackerId: hacker.id, status: 'ACTIVE' },
              },
            },
          },
          {
            registrations: {
              some: {
                hackerId: hacker.id,
                status: 'APPROVED',
                cancelledAt: null,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    // Determine hack_type based on environment
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    // Create project with participants and thumbnail
    const project = await prisma.project.create({
      data: {
        title,
        preview,
        launchLeadId: hacker.id,
        status: 'DRAFT',
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
        eventParticipations: {
          create: activeEvents.map(event => ({
            eventId: event.id,
            addedById: hacker.id,
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
    console.error('[PROJECTS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
