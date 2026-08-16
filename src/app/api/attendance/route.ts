import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getOrCreateCurrentWeek } from '@/lib/weeks';

export async function POST(req: Request) {
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

    const now = new Date();
    const currentWeek = await getOrCreateCurrentWeek();

    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        hackerId_weekId: {
          hackerId: hacker.id,
          weekId: currentWeek.id,
        },
      },
    });

    if (existingAttendance) {
      return new NextResponse('Already checked in for this week', {
        status: 400,
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        hackerId: hacker.id,
        weekId: currentWeek.id,
      },
    });

    await prisma.hacker.update({
      where: { id: hacker.id },
      data: { lastAttendance: now },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('[ATTENDANCE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekId = searchParams.get('weekId');

    if (!weekId) {
      return new NextResponse('Week ID is required', { status: 400 });
    }

    const attendance = await prisma.attendance.findMany({
      where: {
        weekId,
      },
      include: {
        hacker: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('[ATTENDANCE_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
