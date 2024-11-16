import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    let currentWeek = await prisma.week.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        attendance: {
          include: {
            hacker: {
              select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
        },
        projects: {
          include: {
            thumbnail: true,
            launchLead: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
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
        include: {
          attendance: {
            include: {
              hacker: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  role: true,
                },
              },
            },
          },
          projects: {
            include: {
              thumbnail: true,
              launchLead: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json(currentWeek);
  } catch (error) {
    console.error("[CURRENT_WEEK_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
