import { NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = getAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get expiration time from request body (in seconds), default to 60 seconds
    const { expiresInSeconds = 60 } = await req.json().catch(() => ({}));

    // Validate expiration time
    const validatedExpiration = Math.min(
      Math.max(Number(expiresInSeconds), 60),
      86400
    ); // Between 60s and 24h

    // Get the hacker using clerkId
    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!hacker) {
      return NextResponse.json({ error: "Hacker not found" }, { status: 404 });
    }

    // Get token using the split-key template
    const token = await getToken({
      expiresInSeconds: validatedExpiration,
      template: "split-key",
      // Note: Clerk handles token expiration through the template configuration
    });

    if (!token) {
      return NextResponse.json(
        { error: "Failed to generate token" },
        { status: 500 }
      );
    }

    // Create or update API key record with our own expiration tracking
    const apiKey = await prisma.apiKey.create({
      data: {
        key: token,
        name: "Split Key Token",
        ownerId: hacker.id,
        maxUsers: 1,
        expiresAt: new Date(Date.now() + validatedExpiration * 1000),
        users: {
          create: {
            hackerId: hacker.id,
          },
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

    return NextResponse.json({
      token,
      expiresIn: `${validatedExpiration} seconds`,
      message:
        "New access token generated successfully. Use this as your Bearer token.",
      metrics: {
        usageCount: 0,
        lastUsed: null,
        maxUsers: apiKey.maxUsers,
        isRevoked: apiKey.isRevoked,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    console.error("[NEW_TOKEN]", error);
    return NextResponse.json(
      { error: "Failed to generate token. Please try again later." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const hacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      include: {
        apiKeyUsers: {
          include: {
            apiKey: true,
          },
        },
      },
    });

    if (!hacker) {
      return NextResponse.json({ error: "Hacker not found" }, { status: 404 });
    }

    // Get all active tokens and their metrics
    const activeTokens = hacker.apiKeyUsers.map((keyUser) => ({
      token: keyUser.apiKey.key,
      usageCount: keyUser.usageCount,
      lastUsed: keyUser.lastUsed,
      isRevoked: keyUser.apiKey.isRevoked,
      createdAt: keyUser.apiKey.createdAt,
      expiresAt: keyUser.apiKey.expiresAt,
    }));

    return NextResponse.json({ tokens: activeTokens });
  } catch (error) {
    console.error("[GET_TOKEN_METRICS]", error);
    return NextResponse.json(
      { error: "Failed to fetch token metrics" },
      { status: 500 }
    );
  }
}
