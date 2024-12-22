import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export default authMiddleware({
  publicRoutes: ["/", "/api/projects(.*)"], // Adjust public routes as needed
  async afterAuth(auth, req) {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey) {
      try {
        // Find API key and authorized user
        const keyData = await prisma.apiKey.findUnique({
          where: { key: apiKey },
          include: {
            users: {
              include: {
                hacker: true,
              },
            },
          },
        });

        if (
          !keyData ||
          keyData.isRevoked ||
          (keyData.expiresAt && keyData.expiresAt < new Date())
        ) {
          return new NextResponse("Invalid API key", { status: 401 });
        }

        // Get user from request
        const hackerId = req.headers.get("x-hacker-id");
        const keyUser = keyData.users.find((u) => u.hacker.id === hackerId);

        if (!keyUser) {
          return new NextResponse("Unauthorized for this API key", {
            status: 401,
          });
        }

        // Check usage limit if set
        if (keyData.usageLimit && keyUser.usageCount >= keyData.usageLimit) {
          return new NextResponse("Usage limit exceeded", { status: 429 });
        }

        // Update usage statistics
        await prisma.apiKeyUser.update({
          where: {
            apiKeyId_hackerId: {
              apiKeyId: keyData.id,
              hackerId: keyUser.hackerId,
            },
          },
          data: {
            usageCount: { increment: 1 },
            lastUsed: new Date(),
          },
        });

        // Add user info to request
        req.headers.set("x-hacker-id", keyUser.hackerId);
        req.headers.set("x-hacker-role", keyUser.hacker.role || "HACKER");
        return;
      } catch (error) {
        console.error("API key validation error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
      }
    }

    // Check for Bearer token authentication
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        // The token will be verified automatically by Clerk middleware
        // Access custom claims from auth.sessionClaims
        const apiAccess = auth.sessionClaims?.api_access as {
          key?: string;
          expires_at?: string;
          permissions?: string[];
        };

        if (!apiAccess?.key) {
          return new NextResponse("Invalid API token", { status: 401 });
        }

        // Check expiration
        if (
          apiAccess.expires_at &&
          new Date(apiAccess.expires_at) < new Date()
        ) {
          return new NextResponse("API token expired", { status: 401 });
        }

        // Add claims to headers for downstream use
        req.headers.set("x-hacker-id", auth.userId as string);
        req.headers.set("x-api-key", apiAccess.key);
        if (apiAccess.permissions) {
          req.headers.set("x-permissions", apiAccess.permissions.join(","));
        }
        return;
      } catch (error) {
        console.error("Token validation error:", error);
        return new NextResponse("Invalid token", { status: 401 });
      }
    }

    // Only check for PATCH/DELETE requests to projects
    if (
      req.nextUrl.pathname.startsWith("/api/projects") &&
      (req.method === "PATCH" || req.method === "DELETE")
    ) {
      try {
        const clerkId = auth.userId;
        if (!clerkId) return new NextResponse("Unauthorized", { status: 401 });

        // Skip middleware check for submit endpoint
        if (req.nextUrl.pathname.includes("/submit")) {
          return; // Let the route handler handle authorization
        }

        // Get the request body if it exists
        let body;
        try {
          body = await req.clone().json();
        } catch {
          body = {};
        }

        // Only check admin status if trying to:
        // 1. Change is_starred
        // 2. Change status from PENDING to APPROVED
        // 3. Delete a project
        if (
          body.is_starred !== undefined ||
          body.status === "APPROVED" ||
          req.method === "DELETE"
        ) {
          // Fetch user role from your database
          const response = await fetch(
            `${req.nextUrl.origin}/api/hackers?clerkId=${clerkId}`
          );
          if (!response.ok) throw new Error("Failed to fetch user");

          const userData = await response.json();
          if (userData.role !== "ADMIN") {
            return new NextResponse("Unauthorized", { status: 401 });
          }
        }
      } catch (error) {
        console.error("Middleware error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
      }
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
