import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clerkId = searchParams.get("clerkId");

    if (clerkId) {
      // If clerkId is provided, return that specific hacker
      const hacker = await prisma.hacker.findUnique({
        where: { clerkId },
        select: {
          id: true,
          name: true,
          role: true,
        },
      });

      if (!hacker) {
        return NextResponse.json(
          { error: "Builder not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(hacker);
    }

    // If no clerkId, return all hackers (you might want to add pagination here)
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
    console.error("Error fetching builder:", error);
    return NextResponse.json(
      { error: "Error fetching builder" },
      { status: 500 }
    );
  }
}
