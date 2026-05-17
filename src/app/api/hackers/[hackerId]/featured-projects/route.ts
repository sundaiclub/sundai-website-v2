import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const MAX_FEATURED = 3;

export async function PUT(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestingHacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!requestingHacker || requestingHacker.id !== params.hackerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ids: unknown = body?.featuredProjectIds;

    if (
      !Array.isArray(ids) ||
      !ids.every((v) => typeof v === "string")
    ) {
      return NextResponse.json(
        { error: "featuredProjectIds must be a string array" },
        { status: 400 }
      );
    }

    const uniqueIds = Array.from(new Set(ids as string[])).slice(0, MAX_FEATURED);

    if (uniqueIds.length > 0) {
      const owned = await prisma.project.findMany({
        where: {
          id: { in: uniqueIds },
          OR: [
            { launchLeadId: params.hackerId },
            { participants: { some: { hackerId: params.hackerId } } },
          ],
        },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((p) => p.id));
      if (uniqueIds.some((id) => !ownedSet.has(id))) {
        return NextResponse.json(
          { error: "Cannot feature a project you are not part of" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.hacker.update({
      where: { id: params.hackerId },
      data: { featuredProjectIds: uniqueIds },
      select: { featuredProjectIds: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating featured projects:", error);
    return NextResponse.json(
      { error: "Failed to update featured projects" },
      { status: 500 }
    );
  }
}
