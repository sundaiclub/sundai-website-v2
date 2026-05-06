# Phase 2: Native Event Pages and RSVP

## Purpose

Replace Partiful for event discovery, event detail pages, RSVP/application submission, attendee status, and organizer review. This phase turns Sundai into the source of truth for published events and applications while keeping check-in and attendance for Phase 3.

## Settled Decisions For This Phase

- Chapter admins publish immediately.
- Events are chapter-scoped, starting with Boston.
- Chapters have their own chapter page and mailing list.
- Chapters do not get bespoke standalone marketing homepages in this cutover.
- Users can RSVP/apply across chapters.
- MCs can approve, waitlist, and reject applicants.
- Co-MCs cannot approve, waitlist, or reject applicants.
- Ban-list users are hidden from MC/co-MC review and default-rejected/blocked internally.
- Users only see that they are waitlisted, not their position.
- Users can cancel.
- Users can edit application answers while pending, but not after approval or rejection.
- Waitlist auto-promotion is an event setting, default off.
- No guest RSVPs.
- Exact address, Zoom, toolkit, and other sensitive resources can be hidden until approval.
- No historical Partiful import in this phase.
- Chapter admins receive no signal at all about globally banned applicants in normal RSVP queues.
- Organizers can manually close applications before capacity is hit.
- Manual application closure blocks all new applications.
- Approval-required is the default application mode for every event.

## Public Routes

### `/events`

Replace the Google Calendar embed with native Sundai event listing.

Required behavior:

- Show upcoming published events across all chapters.
- Support filtering by chapter.
- Show event title, chapter, public location summary, date/time, status, and RSVP state for the current user.
- Show past public events only if product wants an archive; otherwise keep past events linked from chapter pages or reports.
- Keep Google Calendar as a downstream output later, not the authoring surface.

### `/events/[chapterSlug]/[eventSlug]`

The public event detail page should render:

- title
- chapter
- date/time in the chapter timezone
- public event description
- public program/focus wording
- sponsor/expert public message text if provided
- public location summary, such as "Boston, MA" or venue name if allowed
- RSVP/apply button
- current user's application status
- cancellation action for the current user's registration
- add-to-calendar link
- approved-only details after approval

Approved-only details can include:

- exact address
- Zoom or virtual URL
- Discord link
- toolkit links
- check-in QR once Phase 3 exists
- any sponsor/tool credentials that should not be public

### `/chapters`

Simple chapter directory:

- list active chapters
- show city, timezone, and next event
- link to chapter page

### `/chapters/[chapterSlug]`

Chapter page:

- chapter name and city
- upcoming published events for that chapter
- public description
- mailing list signup or subscribe CTA once provider is known
- public past-event/project highlights if Phase 5 exposes them

Do not build a separate custom landing page system per chapter.

## Organizer Routes

### `/organizer/events/new`

Event creation fields:

- chapter
- title
- slug
- public description
- public location summary
- approved-only address/details
- start/end time
- timezone defaults from chapter
- capacity
- application mode
- auto-promote waitlist toggle, default off
- event program type or template
- MCs and co-MCs
- application questions
- confirmation/waitlist/decline message text

Publish behavior:

- Chapter admins can publish immediately for their chapter.
- Site admins can publish anywhere.
- MCs and co-MCs cannot create/publish by default unless later granted.

### `/organizer/events/[eventId]/registrations`

Registration review queue:

- Tabs or filters: pending, approved, waitlisted, declined, cancelled.
- Pending list excludes globally banned users for MCs/co-MCs.
- Site admins can see banned users through a site-admin-only view.
- MC notes are visible in review context.
- MCs can approve, waitlist, decline.
- Co-MCs can view and add notes if assigned, but cannot approve/waitlist/decline.
- Chapter admins and site admins have full review ability.

Review actions:

- approve
- waitlist
- decline
- add internal note
- edit internal note if permissions allow
- cancel/admin-remove if needed

Decline emails should use configurable public message text and never include MC notes.

## Application Form Composition

The application form is assembled from:

1. Site-required template fields.
2. Chapter-level default template fields.
3. Event-level custom questions.

Implementation details:

- Render one merged form to the user.
- Store `applicationJson` on `EventRegistration`.
- Store `applicationSchemaSnapshotJson` or equivalent so historical answers remain interpretable.
- Validate required fields server-side using the snapshot.
- Avoid asking recurrent hackers to re-enter stable profile fields. Prefill profile data and ask them to confirm/update.

Recommended stable profile fields:

- name
- email
- phone number if SMS is active
- GitHub/profile links
- short bio or builder background
- skills/interests

Recommended event-specific fields:

- why this event
- relevant experience for this hack format
- intended role or contribution
- team/project idea if applicable
- sponsor/tool-specific constraints
- optional logistics notes

## Registration Status Rules

### Pending

Default for approval-required events. User sees "Application submitted" and can cancel or edit answers.

If the user edits answers while pending, keep the original submission timestamp and update `updatedAt`.

### Approved

User sees approved state and approved-only details. Confirmation email/SMS can be sent once providers are configured. Application answers are locked.

### Waitlisted

User sees "You are on the waitlist." Do not show waitlist rank.

### Declined

User sees configured decline message text. Internal reasons and MC notes are never exposed. Application answers are locked.

### Cancelled

User can cancel their own registration. Organizers can see cancellations.

## Waitlist Auto-Promotion

Event field:

```prisma
autoPromoteWaitlist Boolean @default(false)
```

Default is off.

If enabled:

- When an approved attendee cancels, promote the oldest waitlisted registration if capacity allows.
- Send approval notification.
- Write an audit record saying the promotion was automatic.

If disabled:

- Approved cancellation frees capacity.
- Organizers choose whether to approve someone from the waitlist manually.

## Ban Filtering Behavior

For MC/co-MC/chapter admin registration lists:

- Banned applicants should not appear in normal review queues.
- MCs/co-MCs should not be told who is banned.
- Chapter admins get no signal at all in normal RSVP queues. Global ban management is site-admin-only.
- The registration should be internally `BLOCKED` or otherwise excluded by a site-admin-only global-ban path.

For site admins:

- Site admins can see banned users and ban state in admin views.
- Site admins can override or revoke bans if needed.

For users:

- Final public message text remains open: generic unable-to-RSVP message, normal declined state, or another policy-approved message.
- Do not leak "you are banned" unless the team explicitly chooses that policy.

## API Scope

New or changed routes:

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/[eventId]`
- `PATCH /api/events/[eventId]`
- `POST /api/events/[eventId]/publish`
- `POST /api/events/[eventId]/registrations`
- `GET /api/events/[eventId]/registrations`
- `PATCH /api/events/[eventId]/registrations/me` for pending users editing application answers
- `PATCH /api/events/[eventId]/registrations/[registrationId]`
- `POST /api/events/[eventId]/registrations/[registrationId]/notes`
- `POST /api/events/[eventId]/registrations/[registrationId]/cancel`
- `POST /api/events/[eventId]/registrations/me/cancel`
- `POST /api/events/[eventId]/applications/close`
- `POST /api/events/[eventId]/applications/open`

Use permission helpers from Phase 1.

## Migration From Current `/pitch`

During this phase:

- `/pitch` can continue to exist.
- New public `/events` should link to the existing pitch workspace where relevant.
- Do not block Phase 2 on merging organizer workspace and pitch UI.

## Tests

Add tests for:

- Public event listing only shows published events.
- Event detail hides approved-only details from anonymous/pending users.
- Approved user can see approved-only details.
- Chapter admin can publish own chapter event.
- MC can approve/waitlist/decline.
- Co-MC cannot approve/waitlist/decline.
- User can cancel own registration.
- Pending user can edit own application answers.
- Approved/declined user cannot edit application answers.
- Waitlist auto-promotion defaults off.
- Waitlist auto-promotion works when enabled.
- Organizer can manually close applications before capacity is hit.
- Approval-required is the default event application mode.
- Banned applicants are hidden from MC review query.
- Application schema merge order works.

## Not Happening In This Phase

- Check-in QR and scanner.
- Attendance migration.
- SMS provider implementation unless chosen early.
- Historical Partiful import.
- Guest RSVPs.
- Public waitlist rank.
- Custom chapter landing page builder.
- Replacing the pitch queue.

## Remaining Questions

1. What exact public message text should declined users see?
2. What exact public message text should blocked users see when trying to RSVP?
3. What production email provider should be used?
