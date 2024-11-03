import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const hackers = await prisma.hacker.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(hackers);
  } catch (error) {
    console.error("Error fetching hackers:", error);
    return NextResponse.json(
      { error: "Error fetching hackers" },
      { status: 500 }
    );
  }
}
