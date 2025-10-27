import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { eventProjectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({ where: { clerkId: userId }, select: { role: true } });
    if (user?.role !== "ADMIN") return new NextResponse("Unauthorized", { status: 401 });

    const { status, approved } = await req.json();

    const updated = await prisma.eventProject.update({
      where: { id: params.eventProjectId },
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


