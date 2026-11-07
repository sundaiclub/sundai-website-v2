import {
  isProjectEditLocked,
  projectEditLockResponse,
} from '@/lib/projectEditLock';
import { projectReadAccessWhere } from '@/lib/projectReadAccess';
import {
  privateJson,
  publicFields,
  publicProjectSelect,
} from '@/lib/publicData';
import { JUDGE_TOKEN_HEADER } from '@/types/judging';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    const viewer = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { id: true, role: true },
        })
      : null;
    const visibility =
      viewer?.role === 'SITE_ADMIN'
        ? {}
        : await projectReadAccessWhere(
            userId,
            new URL(req.url).searchParams.get('event'),
            req.headers.get(JUDGE_TOKEN_HEADER)
          );
    const project = await prisma.project.findUnique({
      where: { id: params.projectId, AND: visibility },
      select: {
        ...publicProjectSelect,
        thumbnail: {
          select: { ...publicProjectSelect.thumbnail.select, prompt: true },
        },
      },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    return privateJson({
      ...publicFields(project, publicProjectSelect),
      ...(viewer &&
      (viewer.role === 'SITE_ADMIN' ||
        project.launchLead.id === viewer.id ||
        project.participants.some(member => member.hacker.id === viewer.id))
        ? {
            thumbnail: project.thumbnail
              ? {
                  url: project.thumbnail.url,
                  alt: project.thumbnail.alt,
                  prompt: project.thumbnail.prompt,
                }
              : null,
          }
        : {}),
      editLockedForJudging: await isProjectEditLocked(params.projectId),
      likes: project.likes.map(like => ({
        hackerId: like.hackerId,
        createdAt: like.createdAt,
      })),
    });
  } catch (error) {
    console.error('[PROJECT_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse('Builder not found', { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        likes: true,
        participants: true,
      },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const isAdmin = hacker.role === 'SITE_ADMIN';
    const isLaunchLead = project.launchLeadId === hacker.id;

    if (!isAdmin && !isLaunchLead) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const locked = await projectEditLockResponse(params.projectId, isAdmin);
    if (locked) return locked;

    const pitchEntries = await prisma.pitchProject.findMany({
      where: { projectId: params.projectId },
      select: { id: true },
    });
    const pitchProjectIds = pitchEntries.map(entry => entry.id);

    await prisma.$transaction([
      prisma.pitchProjectVote.deleteMany({
        where: { pitchProjectId: { in: pitchProjectIds } },
      }),
      prisma.pitchProject.deleteMany({
        where: { projectId: params.projectId },
      }),
      prisma.eventProject.deleteMany({
        where: { projectId: params.projectId },
      }),
      prisma.projectLike.deleteMany({
        where: { projectId: params.projectId },
      }),
      prisma.projectToParticipant.deleteMany({
        where: { projectId: params.projectId },
      }),
      prisma.project.delete({
        where: { id: params.projectId },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[PROJECT_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
