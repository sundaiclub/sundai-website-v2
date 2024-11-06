import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Get current week
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

    // Check if already checked in for this week
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        hackerId_weekId: {
          hackerId: hacker.id,
          weekId: currentWeek.id,
        },
      },
    });

    if (existingAttendance) {
      return new NextResponse("Already checked in for this week", {
        status: 400,
      });
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        hackerId: hacker.id,
        weekId: currentWeek.id,
      },
    });

    // Update hacker's last attendance
    await prisma.hacker.update({
      where: { id: hacker.id },
      data: { lastAttendance: now },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("[ATTENDANCE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekId = searchParams.get("weekId");

    if (!weekId) {
      return new NextResponse("Week ID is required", { status: 400 });
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
        timestamp: "desc",
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("[ATTENDANCE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
