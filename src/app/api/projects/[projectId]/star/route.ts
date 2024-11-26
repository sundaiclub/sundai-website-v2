import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { is_starred } = await req.json();

    const updatedProject = await prisma.project.update({
      where: { id: params.projectId },
      data: { is_starred },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("[PROJECT_STAR_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 