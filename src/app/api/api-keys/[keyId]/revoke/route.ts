import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { keyId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const admin = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey = await prisma.apiKey.update({
      where: { id: params.keyId },
      data: { isRevoked: true },
    });

    return NextResponse.json(apiKey);
  } catch (error) {
    console.error("[API_KEY_REVOKE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
