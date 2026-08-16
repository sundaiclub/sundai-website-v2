import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId },
    });

    if (!hacker) {
      return new NextResponse('Hacker not found', { status: 404 });
    }

    const existingLike = await prisma.projectLike.findUnique({
      where: {
        projectId_hackerId: {
          projectId: params.projectId,
          hackerId: hacker.id,
        },
      },
    });

    if (existingLike) {
      return NextResponse.json(existingLike);
    }

    const like = await prisma.projectLike.create({
      data: {
        projectId: params.projectId,
        hackerId: hacker.id,
      },
    });

    return NextResponse.json(like);
  } catch (error) {
    console.error('[PROJECT_LIKE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId },
    });

    if (!hacker) {
      return new NextResponse('Hacker not found', { status: 404 });
    }

    await prisma.projectLike.delete({
      where: {
        projectId_hackerId: {
          projectId: params.projectId,
          hackerId: hacker.id,
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[PROJECT_UNLIKE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
