import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; hackerId: string } }
) {
  try {
    const { projectId, hackerId } = params;

    const { userId } = auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const [currentUser, project] = await Promise.all([
      prisma.hacker.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { launchLeadId: true },
      }),
    ]);

    if (!currentUser) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const canManageTeam =
      currentUser.role === 'SITE_ADMIN' ||
      project.launchLeadId === currentUser.id;
    if (!canManageTeam) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    await prisma.projectToParticipant.delete({
      where: {
        hackerId_projectId: {
          hackerId,
          projectId,
        },
      },
    });

    return NextResponse.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { error: 'Error removing participant' },
      { status: 500 }
    );
  }
}
