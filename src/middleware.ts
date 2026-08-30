import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

export const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/terms',
  '/events(.*)',
  '/chapters(.*)',
  '/projects(.*)',
  '/api/chapters(.*)',
  '/api/events',
  '/api/projects(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/twilio(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const authData = auth();
  if (!isPublicRoute(req)) await authData.protect();
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
