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

    const hacker = await prisma.hacker.findUnique({
      where: { id: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        hackerId: hacker.id,
        date: {
          gte: today,
        },
      },
    });

    if (existingAttendance) {
      if (!existingAttendance.checkOutTime) {
        // Check out
        const checkOutTime = new Date();
        const duration = Math.floor(
          (checkOutTime.getTime() - existingAttendance.checkInTime.getTime()) /
            1000 /
            60
        );

        const updated = await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            checkOutTime,
            duration,
          },
        });

        // Update hacker's total time
        await prisma.hacker.update({
          where: { id: hacker.id },
          data: {
            totalMinutesAttended: {
              increment: duration,
            },
          },
        });

        return NextResponse.json(updated);
      }
      return new NextResponse("Already checked in and out today", {
        status: 400,
      });
    }

    // Create new attendance record
    const attendance = await prisma.attendance.create({
      data: {
        hackerId: hacker.id,
        date: today,
        location: "Remote", // Default to remote
      },
    });

    // Update hacker's last attendance
    await prisma.hacker.update({
      where: { id: hacker.id },
      data: {
        lastAttendance: new Date(),
      },
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const attendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      include: {
        hacker: {
          select: {
            name: true,
            avatar: true,
            totalMinutesAttended: true,
          },
        },
        verifiedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("[ATTENDANCE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
