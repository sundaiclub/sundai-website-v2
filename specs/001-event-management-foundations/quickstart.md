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

## Implemented Surfaces

- Site admins use `SITE_ADMIN` and can manage chapters, chapter admins, global bans, and site application requirements.
- Chapter admins manage only their assigned chapter settings, members, invites, ban flags, templates, and events.
- Hackers can discover/join public chapters, accept private invites, leave chapters, and manage notification preferences.
- Events use `EventStaff` for MC and co-MC assignments. MCs and co-MCs can operate pitch controls; co-MCs cannot make applicant decisions.
- Organizer notes support current-note collaboration for site admins, relevant chapter admins, assigned MCs, and assigned co-MCs. Revision history is limited to site admins and relevant chapter admins.
- Event foundations now include richer metadata, publishing, merged application previews, and internal registration records without exposing public RSVP/application/check-in flows.

## Implementation Checks

Run the focused test suite while building the cutover:

```bash
npm run test -- tests/api/events.test.ts tests/api/events-queue.test.ts tests/contexts/UserContext.test.tsx tests/middleware-comprehensive.test.ts
```

Run story-level checks:

```bash
npm run test -- tests/api/chapters.test.ts tests/api/chapter-admins.test.ts tests/api/application-templates.test.ts tests/api/admin-bans.test.ts tests/pages/AdminEventManagement.test.tsx --runInBand
npm run test -- tests/api/chapter-admin-operations.test.ts tests/api/chapter-application-templates.test.ts tests/api/organizer-events.test.ts tests/api/chapter-ban-flags.test.ts tests/pages/OrganizerChapterSettings.test.tsx --runInBand
npm run test -- tests/api/chapter-visibility.test.ts tests/api/chapter-membership.test.ts tests/pages/ChaptersPage.test.tsx --runInBand
npm run test -- tests/api/events-transition.test.ts tests/api/events-pitch-timer.test.ts tests/api/events-advance.test.ts tests/api/events-queue.test.ts tests/api/events.test.ts tests/api/event-staff.test.ts tests/api/event-registrations.test.ts --runInBand
npm run test -- tests/api/organizer-notes.test.ts tests/lib/organizerNotes.test.ts tests/components/OrganizerNotePanel.test.tsx --runInBand
npm run test -- tests/api/event-management-foundations.test.ts tests/api/event-registrations.test.ts tests/pages/EventsPage.test.tsx --runInBand
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

1. Confirm site role references use `Role.SITE_ADMIN`; remaining `ADMIN` references should be chapter-membership roles or migration assertions only.
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
