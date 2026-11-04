import { visibleProjectsWhere } from '@/lib/projectVisibility';
import {
  privateJson,
  publicFields,
  publicProjectSelect,
} from '@/lib/publicData';
import { HackType, Prisma, ProjectStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getOrCreateCurrentWeek } from '@/lib/weeks';
import {
  projectEventAccessWhere,
  projectEventWindowWhere,
} from '@/lib/projectEvents';

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

    const { userId } = await auth();
    const viewer = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { role: true },
        })
      : null;
    const projectWhere: Prisma.ProjectWhereInput = {
      AND: [
        visibleProjectsWhere(userId, viewer?.role === 'SITE_ADMIN'),
        status ? { status: status as ProjectStatus } : {},
        { hack_type },
        ...ignoredDomainTagsFilter,
      ],
    };

    const projects = await prisma.project.findMany({
      where: projectWhere,
      select: publicProjectSelect,
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
      ...publicFields(project, publicProjectSelect),
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

      return privateJson({
        projects: serializedProjects.slice(0, safeLimit),
        hasMore: serializedProjects.length > safeLimit!,
        totalCount,
      });
    }

    return privateJson(serializedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return privateJson({ error: 'Error fetching projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const preview = formData.get('preview') as string;
    const members = JSON.parse(formData.get('members') as string);

    if (!title) {
      return privateJson(
        {
          message: 'Title is required',
        },
        { status: 400 }
      );
    }

    if (!preview) {
      return privateJson(
        {
          message: 'Preview is required',
        },
        { status: 400 }
      );
    }

    if (preview.length > 100) {
      return privateJson(
        {
          message: 'Preview must be 100 characters or less',
        },
        { status: 400 }
      );
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse('Builder not found', { status: 404 });
    }

    const eventIds = Array.from(
      new Set(
        formData
          .getAll('eventIds[]')
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );
    if (eventIds.length > 0) {
      const events = await prisma.event.findMany({
        where: {
          ...projectEventAccessWhere(hacker),
          id: { in: eventIds },
          AND: [projectEventWindowWhere(new Date())],
        },
        select: { id: true },
      });
      if (events.length !== eventIds.length) {
        return privateJson(
          {
            message:
              'One or more selected events are unavailable or submissions have closed',
          },
          { status: 403 }
        );
      }
    }

    const currentWeek = await getOrCreateCurrentWeek();
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    const project = await prisma.project.create({
      data: {
        title,
        preview,
        launchLeadId: hacker.id,
        status: 'DRAFT',
        ...(eventIds.length > 0
          ? {
              eventParticipations: {
                create: eventIds.map(eventId => ({
                  eventId,
                  addedById: hacker.id,
                })),
              },
            }
          : {}),
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
      select: publicProjectSelect,
    });

    return privateJson(publicFields(project, publicProjectSelect));
  } catch (error) {
    console.error('[PROJECTS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
