# Quickstart: Native Event Pages and RSVP

## Prerequisites

- Arch Linux development machine.
- Node dependencies installed with the existing project package manager.
- PostgreSQL available through `docker compose` or an existing `DATABASE_URL`.
- Phase 1 event-management foundations present: chapters, `SITE_ADMIN`, `EventStaff`, application templates, internal registrations, global bans, organizer notes, and shared permission helpers.

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

## Implementation Acceptance Checklist

- [ ] `EventApplicationMode` defaults to `REQUIRES_APPROVAL`; `OPEN_RSVP` is accepted where configured; stale `NONE`, `INTERNAL`, and `PUBLIC_LATER` behavior is absent.
- [ ] Public registration source is `WEBSITE`; application open/closed state uses explicit boolean and closed metadata fields.
- [ ] `/events` lists only upcoming published public events, supports chapter filtering, includes signed-in viewer status, and hides unpublished/private data.
- [ ] `/events/[chapterSlug]/[eventSlug]` renders public details, add-to-calendar payloads, current registration state, and approved-only detail redaction.
- [ ] Signed-in hackers can submit applications, edit answers while pending without changing `submittedAt`, see safe status messages, and cancel their own registrations.
- [ ] Approved, declined, waitlisted, blocked, and cancelled users cannot edit locked answers and never receive internal notes, moderation state, ban reasons, waitlist rank, or decision reasons from public responses.
- [ ] Chapter admins and site admins can create, configure, publish, close, reopen, and update in-scope events; MCs and co-MCs cannot create or publish by staff role alone.
- [ ] Organizer review supports status filters, applicant answers, internal event-specific notes, MC/chapter-admin/site-admin decisions, co-MC note-only access, and audit entries.
- [ ] Globally banned applicants are hidden from non-site-admin queues with no ban signal; site admins can request banned context explicitly.
- [ ] Manual application closure blocks new submissions while preserving existing registration edit, cancellation, and review behavior.
- [ ] Waitlist auto-promotion defaults off and promotes only the oldest eligible waitlisted registration when enabled and capacity allows.
- [ ] `/chapters` and `/chapters/[chapterSlug]` show active public chapter metadata, next/upcoming published events, private chapter visibility rules, and mailing-list CTA data.
- [ ] Out-of-scope surfaces remain absent: guest RSVP, QR check-in, attendance migration, historical import, public waitlist rank, custom chapter homepage builder, and pitch queue replacement.

## Focused Test Commands

Run public discovery and application checks:

```bash
npm run test -- tests/api/public-events.test.ts tests/api/public-event-registrations.test.ts tests/pages/EventsPage.test.tsx tests/pages/EventDetailPage.test.tsx --runInBand
```

Run organizer review, application controls, and settings checks:

```bash
npm run test -- tests/api/event-registration-review.test.ts tests/api/event-application-controls.test.ts tests/pages/OrganizerEventRegistrations.test.tsx tests/pages/OrganizerEventSettings.test.tsx --runInBand
```

Run chapter directory and chapter detail checks:

```bash
npm run test -- tests/api/chapter-visibility.test.ts tests/api/chapters.test.ts tests/pages/ChaptersPage.test.tsx tests/pages/ChapterPage.test.tsx --runInBand
```

Run shared helper and indexed-query regression checks:

```bash
npm run test -- tests/lib/publicEvents.test.ts tests/lib/chapters.test.ts tests/lib/eventRegistrations.test.ts tests/lib/eventManagementAuth.test.ts tests/lib/applicationTemplates.test.ts --runInBand
```

Run the full suite before handoff:

```bash
npm run test
```

Run the production build before release:

```bash
npm run build
```

## Manual Acceptance Checklist

- [ ] Create or use an active Boston chapter with public metadata and mailing-list CTA data.
- [ ] Sign in as a Boston chapter admin and create an approval-required event with public location, approved-only details, capacity, event questions, public status messages, and assigned MC/co-MC staff.
- [ ] Publish the event and confirm `/events` shows it, chapter filtering works, and unpublished or private events are excluded.
- [ ] Open `/events/boston/[eventSlug]` while signed out and confirm public fields render, approved-only details are redacted, and no application form is available to guests.
- [ ] Sign in as a hacker, submit the event application, and confirm pending state, safe public status text, `WEBSITE` source, and template snapshot behavior.
- [ ] Edit pending answers and confirm `submittedAt` remains unchanged.
- [ ] Approve the applicant as an assigned MC and confirm approved-only details render for that user.
- [ ] Confirm approved, declined, waitlisted, blocked, and cancelled users cannot edit answers after a decision or terminal state.
- [ ] Cancel as the approved user and confirm organizer review shows cancellation fields and audit history.
- [ ] As a co-MC, confirm internal notes can be added but approve, waitlist, decline, cancel, close, reopen, and publish controls are unavailable.
- [ ] As a chapter admin or site admin, confirm status filters, applicant answers, internal notes, decisions, close/reopen controls, capacity display, and auto-promote settings work in scope.
- [ ] Disable auto-promotion, cancel an approved attendee, and confirm no waitlisted user is promoted.
- [ ] Enable auto-promotion, cancel an approved attendee, and confirm the oldest eligible waitlisted user is promoted without exposing public waitlist rank.
- [ ] Create a globally banned applicant and confirm non-site-admin queues hide them without any ban signal.
- [ ] Confirm site admins can explicitly include banned users and see blocked/banned context.
- [ ] Close applications manually and confirm new applications are blocked while existing registrations remain reviewable, editable when pending, and cancellable.
- [ ] Reopen applications and confirm new signed-in users can submit again.
- [ ] Visit `/chapters` and `/chapters/boston` to confirm active chapter metadata, next/upcoming published event links, private chapter visibility rules, and mailing-list CTA rendering.
- [ ] Confirm out-of-scope surfaces are still absent: guest RSVP, QR check-in, attendance migration, historical import, public waitlist rank, custom chapter homepage builder, and pitch queue replacement.
