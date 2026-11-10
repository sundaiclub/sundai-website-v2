import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

export const isPublicRoute = createRouteMatcher([
  '/',
  '/guide',
  '/join',
  '/privacy',
  '/terms',
  '/events(.*)',
  '/chapters(.*)',
  '/projects(.*)',
  '/api/chapters(.*)',
  '/api/events',
  // Anyone can read and share project ideas on a public event.
  '/api/events/:eventId/ideas',
  '/api/projects(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/twilio(.*)',
  // SES delivery events arrive from AWS SNS with a signed message.
  '/api/webhooks/ses',
  // Tracked email and SMS links redirect readers who are not signed in.
  '/l/(.*)',
  '/s/(.*)',
  // One-click unsubscribe from the List-Unsubscribe email header.
  '/api/email/unsubscribe/(.*)',
  // Check-in QR images are embedded in emails and load without a session.
  '/api/qr/check-in/(.*)',
  // Judges score with a magic-link token and no Clerk account.
  '/api/judging/(.*)',
  // Vercel's queue trigger is private and has no Clerk browser session.
  '/api/queues/email-delivery',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
