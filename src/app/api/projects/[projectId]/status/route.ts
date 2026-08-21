import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== 'SITE_ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { status } = await req.json();

    const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: { status },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('[PROJECT_STATUS_UPDATE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
