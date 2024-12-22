import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

// Generate a secure API key
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(24).toString("hex")}`;
}

// Get API access details
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    const apiAccess = user.privateMetadata.api_access;

    return NextResponse.json(apiAccess || {});
  } catch (error) {
    console.error("[API_ACCESS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Create or update API access
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if requester is admin
    const user = await clerkClient.users.getUser(userId);
    if (user.privateMetadata.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { targetUserId, permissions, expiresInDays } = await req.json();

    // Generate API access data
    const apiAccess = {
      key: generateApiKey(),
      permissions: permissions || ["read"],
      created_at: new Date().toISOString(),
      expires_at: expiresInDays
        ? new Date(
            Date.now() + expiresInDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : null,
    };

    // Update target user's private metadata
    await clerkClient.users.updateUser(targetUserId, {
      privateMetadata: {
        api_access: apiAccess,
      },
    });

    return NextResponse.json(apiAccess);
  } catch (error) {
    console.error("[API_ACCESS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// Revoke API access
export async function DELETE(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if requester is admin
    const user = await clerkClient.users.getUser(userId);
    if (user.privateMetadata.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { targetUserId } = await req.json();

    // Remove API access from target user's private metadata
    await clerkClient.users.updateUser(targetUserId, {
      privateMetadata: {
        api_access: null,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API_ACCESS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
