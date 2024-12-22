import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Add users to an API key
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

    const { userIds } = await req.json();

    // Get current key and user count
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: params.keyId },
      include: { users: true },
    });

    if (!apiKey) {
      return new NextResponse("API key not found", { status: 404 });
    }

    if (apiKey.users.length + userIds.length > apiKey.maxUsers) {
      return new NextResponse(
        `Cannot add users. Maximum of ${apiKey.maxUsers} users allowed`,
        { status: 400 }
      );
    }

    // Add new users
    const updatedKey = await prisma.apiKey.update({
      where: { id: params.keyId },
      data: {
        users: {
          create: userIds.map((hackerId: string) => ({
            hackerId,
          })),
        },
      },
      include: {
        users: {
          include: {
            hacker: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedKey);
  } catch (error) {
    console.error("[API_KEY_ADD_USERS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
