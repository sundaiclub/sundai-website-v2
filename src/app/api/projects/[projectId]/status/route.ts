import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.hacker.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    console.log(user);
    if (user?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    const project = await prisma.project.update({
      where: { id: params.projectId },
      data: { status },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("[PROJECT_STATUS_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
