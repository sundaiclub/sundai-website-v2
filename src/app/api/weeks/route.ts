import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const weeks = await prisma.week.findMany({
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
      orderBy: {
        number: "desc",
      },
    });

    return NextResponse.json(weeks);
  } catch (error) {
    console.error("[WEEKS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
