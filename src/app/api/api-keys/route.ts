import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// Generate a secure API key
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(24).toString("hex")}`;
}

// List API keys
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      include: {
        apiKeys: {
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
        },
        apiKeyUsers: {
          include: {
            apiKey: true,
          },
        },
      },
    });

    if (!hacker) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // If admin, return all keys they own
    if (hacker.role === "ADMIN") {
      return NextResponse.json({
        ownedKeys: hacker.apiKeys,
        sharedKeys: hacker.apiKeyUsers,
      });
    }

    // For regular users, only return keys shared with them
    return NextResponse.json({
      sharedKeys: hacker.apiKeyUsers,
    });
  } catch (error) {
    console.error("[API_KEYS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Create new API key
export async function POST(req: Request) {
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

    const { name, userIds, maxUsers, usageLimit, expiresAt } = await req.json();

    // Create API key with initial users
    const apiKey = await prisma.apiKey.create({
      data: {
        key: generateApiKey(),
        name,
        ownerId: admin.id,
        maxUsers: maxUsers || 10,
        usageLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
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

    return NextResponse.json(apiKey);
  } catch (error) {
    console.error("[API_KEYS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
