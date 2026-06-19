import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string; pitchProjectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    if (user.role === "SITE_ADMIN") {
      const { status, approved } = await req.json();

      const updated = await prisma.pitchProject.update({
        where: { id: params.pitchProjectId },
        data: {
          status: status ?? undefined,
          approved: typeof approved === "boolean" ? approved : undefined,
        },
      });

      return NextResponse.json(updated);
    }

    const pitchProject = await prisma.pitchProject.findUnique({
      where: { id: params.pitchProjectId },
      select: {
        pitchSession: {
          select: {
            eventId: true,
            event: {
              select: {
                staff: { select: { hackerId: true, role: true } },
              },
            },
          },
        },
      },
    });
    if (!pitchProject) return new NextResponse("Unauthorized", { status: 401 });
    if (pitchProject.pitchSession.eventId !== params.eventId) {
      return new NextResponse("Not found", { status: 404 });
    }

    const isStaff = (pitchProject.pitchSession.event?.staff ?? []).some(
      (staff) => staff.hackerId === user.id
    );
    if (!isStaff) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { status, approved } = await req.json();

    const updated = await prisma.pitchProject.update({
      where: { id: params.pitchProjectId },
      data: {
        status: status ?? undefined,
        approved: typeof approved === "boolean" ? approved : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[QUEUE_STATUS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
