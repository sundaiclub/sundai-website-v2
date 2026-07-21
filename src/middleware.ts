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
  if (
    req.nextUrl.pathname.startsWith('/api/projects') &&
    (req.method === 'PATCH' || req.method === 'DELETE')
  ) {
    try {
      const clerkId = auth.userId;
      if (!clerkId) return NextResponse.json('Unauthorized', { status: 401 });

      if (req.nextUrl.pathname.includes('/submit')) {
        return;
      }

      let body: ProjectMutationBody = {};
      const cloned = req.clone();
      try {
        const parsedBody: unknown = await cloned.json();
        body = isProjectMutationBody(parsedBody) ? parsedBody : {};
      } catch (error: unknown) {
        console.error('Unable to inspect project mutation body:', error);
        return NextResponse.json('Invalid JSON body', { status: 400 });
      }

      if (req.method === 'DELETE' && req.nextUrl.pathname.includes('/like')) {
        return;
      }

      // Star, approval, and deletion changes require site-admin access.
      if (
        body.is_starred !== undefined ||
        body.status === 'APPROVED' ||
        req.method === 'DELETE'
      ) {
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
  '/api/webhooks/clerk',
]);

export default clerkMiddleware(async (auth, req) => {
  const authData = auth();
  if (!isPublicRoute(req)) await authData.protect();
  return afterAuthHandler(authData, req);
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
