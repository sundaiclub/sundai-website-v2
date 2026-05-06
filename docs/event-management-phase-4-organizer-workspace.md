# Phase 4: Organizer Event Workspace

## Purpose

Give chapter admins, MCs, and co-MCs one operational workspace for running the hack: event details, resources, MC notes, check-in, application review handoff, project cards, pitch queue, communications, and materials. This phase connects the existing `/pitch` work to the broader in-house event system.

## Settled Decisions For This Phase

- `/pitch` already handles pitch queue work and should be reused.
- Projects can be pitched across multiple events.
- Co-MCs can help with pitching, resources, communications, and event operations.
- Co-MCs cannot approve, waitlist, or reject applicants.
- MC notes are visible to site admins, chapter admins, MCs, and co-MCs in organizer contexts.
- MC notes are one shared notepad per hacker, collaboratively edited by organizers.
- MC note edit history is shown only to chapter admins and site admins.
- Exact event details/resources can be hidden until approval for attendees, but visible to organizers.
- SMS is desired in v1 directionally, likely Twilio, but provider details remain open.
- Email provider remains TBD.
- Materials support both file uploads and URL links.
- Existing project card completion behavior is fine; do not add new pitch-blocking requirements now.
- Long-term pitch route should probably move under `/organizer/events/[eventId]`.
- Communications are email/SMS only for now.

## Workspace Route

Recommended route:

- `/organizer/events/[eventId]`

Tabs:

- Overview
- RSVPs
- Communications
- Materials
- Check-in
- Projects
- Pitch
- Notes
- Reporting preview

The existing `/pitch/[eventId]` can either:

- become the Pitch tab inside organizer workspace, or
- remain as a focused full-screen pitch controller linked from the Pitch tab.

Recommendation:

- Move pitch controls under `/organizer/events/[eventId]` over time.
- During migration, `/pitch/[eventId]` can remain as a focused compatibility route or redirect.

## Overview Tab

Show:

- event title/status
- chapter
- start/end time
- capacity
- application mode
- auto-promote waitlist state
- MC/co-MC list
- public event URL
- approved-only details status
- key counts: pending, approved, waitlisted, declined, cancelled, checked in, project cards, pitches

Actions:

- edit event details
- publish/unpublish/cancel if allowed
- assign MCs/co-MCs if allowed
- copy public URL
- open pitch controller
- open check-in

## RSVPs Tab

This tab is mostly delivered in Phase 2, but Phase 4 makes it part of the full workspace.

Role behavior:

- MC: can approve, waitlist, reject, add notes.
- Co-MC: can view assigned-event RSVPs and notes if useful for operations, but cannot approve, waitlist, or reject.
- Chapter admin/site admin: full management.

Ban behavior:

- Banned users remain hidden from MC/co-MC queues.
- Site admins manage and inspect banned users elsewhere.

## Communications Tab

Purpose:

- Replace Partiful blasts for event-level communication.
- Send to clear audiences without ad hoc CSV exports.

Audiences:

- all registered users
- pending
- approved
- waitlisted
- declined
- checked in
- no-shows
- custom selected users

Channels:

- email
- SMS after provider/consent implementation

Permissions:

- Site admin, chapter admin, and MC can send.
- Co-MC can draft and send because co-MCs have event operations abilities except application decisions.

Delivery log:

- created by
- audience snapshot
- channel
- provider message id
- sent/failed status
- error

Important:

- Communication should use event registration status at send time.
- Store the recipient snapshot so later status changes do not rewrite history.

## Materials Tab

Centralize all hack resources:

- slides
- toolkit
- sponsor brief
- Zoom
- Discord
- brainstorming link
- project card guide
- room setup
- QR links
- social draft
- newsletter draft
- sponsor report draft

Visibility levels:

- organizers only
- approved attendees
- public

This directly addresses the spreadsheet pain point where materials are scattered across Drive, slides, Discord, QR codes, and docs.

## Notes Tab

MC notes about users:

- visible to site admins, chapter admins, MCs, co-MCs.
- hidden from users.
- not a ban list.
- not used for automated rejection.
- one shared notepad per hacker, not a comment thread.
- editable by organizers with access to the user in an event workflow.
- edit log visible only to site admins and chapter admins.

Surfaces:

- applicant profile in RSVP review
- check-in manual lookup
- event notes tab

Suggested note structure:

- one current notepad body
- revision history with editor and timestamp

Avoid sensitive protected-class data in notes unless legally reviewed and operationally necessary.

## Projects Tab

Current project model:

- `Project` is global.
- `EventProject` connects a project to an event.
- Same project can already effectively appear across weeks; the new model should allow same project across multiple events.

Phase 4 should make event project state more visible:

- projects attached to this event
- project card completion state
- launch lead and team
- tags
- demo/GitHub/blog links
- pitch queue status
- whether it pitched
- whether it was highlighted

Do not require a new project per event.

Potential addition:

```prisma
EventProject.cardStatus
```

Values:

- `DRAFT`
- `NEEDS_INFO`
- `SUBMITTED`
- `APPROVED`

Use this for organizer reporting hygiene only. The current project card and pitch queue behavior is acceptable and should not gain new pitch-blocking gates in this phase.

## Pitch Tab

Reuse existing `/pitch` implementation:

- event voting
- project queue
- MC controls
- phase transitions
- pitch timers
- top-project ranking
- event project votes

Permission updates:

- Site admin: full pitch control.
- Chapter admin: full pitch control for own chapter event.
- MC: full pitch control.
- Co-MC: full pitch control.
- Hacker: existing own-project/voting behavior.

This phase should not redesign the pitch UX unless necessary to connect permissions and navigation.

## API Scope

New or expanded routes:

- `POST /api/events/[eventId]/staff`
- `DELETE /api/events/[eventId]/staff/[staffId]`
- `GET /api/events/[eventId]/materials`
- `POST /api/events/[eventId]/materials`
- `PATCH /api/events/[eventId]/materials/[materialId]`
- `DELETE /api/events/[eventId]/materials/[materialId]`
- `GET /api/events/[eventId]/notes`
- `POST /api/events/[eventId]/notes`
- `PATCH /api/events/[eventId]/notes/[noteId]`
- `GET /api/events/[eventId]/blasts`
- `POST /api/events/[eventId]/blasts`
- `POST /api/events/[eventId]/blasts/[blastId]/send`

Existing pitch routes should swap to the new helpers:

- `requireEventPitchController(eventId)` for site admin/chapter admin/MC/co-MC.
- Keep user-level project queue permissions as already implemented where appropriate.

## Tests

Add tests for:

- Co-MC can access pitch controls.
- Co-MC cannot approve/reject RSVPs.
- MC notes are not included in public/user APIs.
- MC notes are visible in organizer APIs.
- Material visibility hides approved-only resources from pending users.
- Communication audience snapshots exclude cancelled users if audience says approved only.
- Existing pitch queue tests still pass after permission helper cutover.

## Not Happening In This Phase

- Rebuilding `/pitch` from scratch.
- Fully automated newsletter/social publishing.
- Guest workflows.
- Ban management by MCs.
- Automated rejection from MC notes.
- Historical Partiful import.
- Sponsor portal unless chosen in remaining questions.

## Remaining Questions

1. What exact SMS consent language should be captured before sending event SMS?
2. Should `/pitch/[eventId]` redirect to `/organizer/events/[eventId]`, or stay as a separate focused presentation route linked from the organizer workspace?
3. What file size/type limits should event material uploads enforce?
