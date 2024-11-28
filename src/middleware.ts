import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/", "/api/projects(.*)"], // Adjust public routes as needed
  async afterAuth(auth, req) {
    // Only check for PATCH/DELETE requests to projects
    if (req.nextUrl.pathname.startsWith("/api/projects") && 
        (req.method === "PATCH" || req.method === "DELETE")) {
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
          (body.status === "APPROVED") ||
          req.method === "DELETE"
        ) {
          // Fetch user role from your database
          const response = await fetch(`${req.nextUrl.origin}/api/hackers?clerkId=${clerkId}`);
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
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
