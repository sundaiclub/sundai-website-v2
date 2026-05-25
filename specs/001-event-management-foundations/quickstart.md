# Quickstart: Event Management Foundations

## Prerequisites

- Arch Linux development machine
- Node dependencies installed with the existing project package manager
- PostgreSQL available through `docker compose` or an existing `DATABASE_URL`

## Setup

1. Install dependencies if needed:

   ```bash
   npm install
   ```

2. Start PostgreSQL:

   ```bash
   npm run db:up
   ```

3. Apply Prisma migrations during implementation:

   ```bash
   npm run db:migrate
   ```

4. Regenerate Prisma Client after schema changes:

   ```bash
   npx prisma generate
   ```

## Implementation Checks

Run the focused test suite while building the cutover:

```bash
npm run test -- tests/api/events.test.ts tests/api/events-queue.test.ts tests/contexts/UserContext.test.tsx tests/middleware-comprehensive.test.ts
```

Run the full Jest suite before handoff:

```bash
npm run test
```

Run the production build when route and UI work is complete:

```bash
npm run build
```

## Manual Acceptance Flow

1. Confirm `Role.ADMIN` references are gone from Prisma schema, app code, and tests.
2. Confirm the migration creates the Boston chapter with slug `boston` and associates every existing event with it.
3. Sign in as a site admin and create a public chapter and a private chapter.
4. Assign and remove chapter admins from the site-admin chapter surface.
5. Sign in as a chapter admin and verify they can manage only their authorized chapter.
6. Join a public chapter as a signed-in hacker and update notification preferences.
7. Invite a hacker to a private chapter, then accept the invite as that hacker.
8. Confirm unauthorized users cannot see the private chapter.
9. Assign an MC and co-MC to an event and verify current pitch controls still work for both roles.
10. Verify co-MC applicant decision actions are denied.
11. Create a site template and chapter template, then preview merged site + chapter + event questions.
12. Confirm site-required name/email fields cannot be removed.
13. Create and revoke a global ban as a site admin.
14. Confirm chapter admins can create ban flags but cannot see ban list counts or reasons.
15. Create and edit an organizer note, then verify revision visibility by role.
16. Confirm no new public RSVP, application, approved-detail, RSVP status, or QR check-in page is exposed.
