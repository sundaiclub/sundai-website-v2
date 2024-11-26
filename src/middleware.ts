import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/", "/api/projects(.*)"], // Adjust public routes as needed
  async afterAuth(auth, req) {
    // Only check admin for admin-specific routes
    if (req.nextUrl.pathname.startsWith("/api/projects") && 
        (req.method === "PATCH" || req.method === "DELETE")) {
      try {
        const clerkId = auth.userId;
        if (!clerkId) return new NextResponse("Unauthorized", { status: 401 });

        // Fetch user role from your database
        const response = await fetch(`${req.nextUrl.origin}/api/hackers?clerkId=${clerkId}`);
        if (!response.ok) throw new Error("Failed to fetch user");
        
        const userData = await response.json();
        if (userData.role !== "ADMIN") {
          return new NextResponse("Unauthorized", { status: 401 });
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
