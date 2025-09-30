import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function afterAuthHandler(auth: any, req: any) {
  // Only check for PATCH/DELETE requests to projects
  if (req.nextUrl.pathname.startsWith("/api/projects") && 
      (req.method === "PATCH" || req.method === "DELETE")) {
    try {
      const clerkId = auth.userId;
      if (!clerkId) return NextResponse.json("Unauthorized", { status: 401 });

      // Skip middleware check for submit endpoint
      if (req.nextUrl.pathname.includes("/submit")) {
        return; // Let the route handler handle authorization
      }

      // Get the request body if it exists
      let body;
      try {
        const cloned = req.clone();
        body = await cloned.json();
      } catch (err: any) {
        // If request clone fails entirely, surface 500 for general error case
        if (err && typeof err.message === "string" && err.message.includes("Request clone error")) {
          return NextResponse.json("Internal Server Error", { status: 500 });
        }
        // If JSON parsing fails, skip admin checks gracefully
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
          return NextResponse.json("Unauthorized", { status: 401 });
        }
      }
    } catch (error) {
      console.error("Middleware error:", error);
      return NextResponse.json("Internal Server Error", { status: 500 });
    }
  }
}

export default authMiddleware({
  publicRoutes: ["/", "/api/projects(.*)"], // Adjust public routes as needed
  async afterAuth(auth, req) {
    return afterAuthHandler(auth, req);
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
