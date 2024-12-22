import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

const MAIN_KEY = process.env.MAIN_GROK_KEY;
const SHARED_KEY_NAME = "Shared Grok Key";

// Get or create the shared API key
async function getOrCreateSharedKey(adminId: string) {
  let sharedKey = await prisma.apiKey.findFirst({
    where: { name: SHARED_KEY_NAME },
    include: { users: true },
  });

  if (!sharedKey) {
    sharedKey = await prisma.apiKey.create({
      data: {
        key: MAIN_KEY!,
        name: SHARED_KEY_NAME,
        ownerId: adminId,
        maxUsers: 1000, // High limit for testing
        usageLimit: 1000, // Optional: set a per-user limit
      },
      include: { users: true },
    });
  }

  return sharedKey;
}

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!MAIN_KEY) {
      return new NextResponse("MAIN_GROK_KEY not configured", { status: 500 });
    }

    // Get the requesting hacker
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
      },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Find or create the admin user for key ownership
    const admin = await prisma.hacker.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (!admin) {
      return new NextResponse("No admin found", { status: 500 });
    }

    // Get or create the shared key
    const sharedKey = await getOrCreateSharedKey(admin.id);

    // Check if user already has access
    const existingAccess = await prisma.apiKeyUser.findUnique({
      where: {
        apiKeyId_hackerId: {
          apiKeyId: sharedKey.id,
          hackerId: hacker.id,
        },
      },
    });

    if (existingAccess) {
      return NextResponse.json({
        key: MAIN_KEY,
        usageCount: existingAccess.usageCount,
        lastUsed: existingAccess.lastUsed,
      });
    }

    // Grant access to the user
    const access = await prisma.apiKeyUser.create({
      data: {
        apiKeyId: sharedKey.id,
        hackerId: hacker.id,
      },
    });

    // Return the key and initial usage info
    return NextResponse.json({
      key: MAIN_KEY,
      usageCount: 0,
      lastUsed: null,
      message: "Key access granted. Please monitor your usage.",
    });
  } catch (error) {
    console.error("[GET_GROK_KEY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Get usage statistics for admins
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const admin = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (admin?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sharedKey = await prisma.apiKey.findFirst({
      where: { name: SHARED_KEY_NAME },
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

    if (!sharedKey) {
      return NextResponse.json({ users: [] });
    }

    return NextResponse.json({
      totalUsers: sharedKey.users.length,
      totalUsage: sharedKey.users.reduce(
        (sum, user) => sum + user.usageCount,
        0
      ),
      users: sharedKey.users.map((user) => ({
        name: user.hacker.name,
        email: user.hacker.email,
        usageCount: user.usageCount,
        lastUsed: user.lastUsed,
      })),
    });
  } catch (error) {
    console.error("[GROK_KEY_STATS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
