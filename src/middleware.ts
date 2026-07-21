import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

type MiddlewareAuth = {
  userId: string | null;
  isPublicRoute?: boolean;
  isApiRoute?: boolean;
};

type ProjectMutationBody = {
  is_starred?: unknown;
  status?: unknown;
};

function isProjectMutationBody(value: unknown): value is ProjectMutationBody {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function afterAuthHandler(auth: MiddlewareAuth, req: NextRequest) {
  // Only check for PATCH/DELETE requests to projects
  if (
    req.nextUrl.pathname.startsWith('/api/projects') &&
    (req.method === 'PATCH' || req.method === 'DELETE')
  ) {
    try {
      const clerkId = auth.userId;
      if (!clerkId) return NextResponse.json('Unauthorized', { status: 401 });

      // Skip middleware check for submit endpoint
      if (req.nextUrl.pathname.includes('/submit')) {
        return; // Let the route handler handle authorization
      }

      // Get the request body if it exists
      let body: ProjectMutationBody = {};
      const cloned = req.clone();
      try {
        const parsedBody: unknown = await cloned.json();
        body = isProjectMutationBody(parsedBody) ? parsedBody : {};
      } catch (error: unknown) {
        console.error('Unable to inspect project mutation body:', error);
        return NextResponse.json('Invalid JSON body', { status: 400 });
      }

      // Allow like/unlike without admin: DELETE /api/projects/:id/like should pass
      if (req.method === 'DELETE' && req.nextUrl.pathname.includes('/like')) {
        return;
      }

      // Only check admin status if trying to:
      // 1. Change is_starred
      // 2. Change status from PENDING to APPROVED
      // 3. Delete a project
      if (
        body.is_starred !== undefined ||
        body.status === 'APPROVED' ||
        req.method === 'DELETE'
      ) {
        // Fetch user role from your database
        const response = await fetch(
          `${req.nextUrl.origin}/api/hackers?clerkId=${clerkId}`
        );
        if (!response.ok) throw new Error('Failed to fetch user');

        const userData = await response.json();
        if (userData.role !== 'SITE_ADMIN') {
          return NextResponse.json('Unauthorized', { status: 401 });
        }
      }
    } catch (error) {
      console.error('Middleware error:', error);
      return NextResponse.json('Internal Server Error', { status: 500 });
    }
  }
}

export const isPublicRoute = createRouteMatcher([
  '/',
  '/events(.*)',
  '/chapters(.*)',
  '/api/chapters(.*)',
  '/api/events',
  '/api/projects(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const authData = auth();
  if (!isPublicRoute(req)) await authData.protect();
  return afterAuthHandler(authData, req);
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
