# UI Surface Contract: Organizer Event Workspace

## Route And Shell

`/organizer/events/[eventId]` is the organizer entry point. The shell always shows event identity, chapter, status, schedule, public-link action, the caller's effective event role, and section navigation.

Sections:

1. Overview
2. RSVPs
3. Communications
4. Materials
5. Projects
6. Pitch
7. Notes
8. Reporting preview

Check-in is absent. Attendance/no-show labels appear only as explicitly deferred reporting placeholders.

Unauthorized users receive the existing permission-denied/not-found treatment without workspace metadata. If assignment is removed while open, the next navigation/read/write is denied.

## Overview

Shows:

- event title/status/chapter/schedule/capacity;
- application mode and applications-open state;
- waitlist auto-promotion state;
- MC/co-MC list;
- public event URL;
- whether approved-only details exist (not their content when unauthorized);
- safe registration, project-card, pitch, material, and communication counts.

Admin-only actions: edit details, publish/unpublish/cancel when supported, assign/remove staff.

All organizers: copy public URL, open permitted sections, open focused pitch controller.

No count or empty state reveals globally blocked users to non-site-admins.

## RSVPs

Reuses the completed registration-review UI inside the workspace shell.

- Site/chapter admins and MCs may approve, waitlist, decline, cancel, and add notes in scope.
- Co-MCs may view permitted rows and edit notes but decision controls are absent and API attempts fail.
- Existing global-ban filtering and public/internal message boundaries remain unchanged.

## Communications

States: history empty, draft editing, previewing, preview confirmed, sending, sent, partial failure, total failure, provider unavailable.

The composer requires channel, audience, subject for email, and body. It displays channel availability before editing. SMS is unavailable until provider configuration and versioned user consent are active.

Preview shows exact eligible count and aggregate exclusions without listing moderation reasons. Send requires the displayed fingerprint. A `409` audience change replaces the confirmation panel and requires a new explicit confirmation.

History shows creator/sender, channel, audience label, send time, recipient count, sent/failed counts, and drill-down outcomes. Sent content and snapshot definitions are read-only.

Structured insertion of a material checks its visibility. Organizer-only resources cannot be inserted as publicly retrievable message attachments; copied protected links remain authorization-gated.

## Materials

List groups or labels materials by visibility and shows title, kind, ordering, availability, and file policy.

Create flow:

- choose Link or File;
- see 25 MiB/type policy before selecting a file;
- set title/description/visibility/availability;
- upload directly, verify, then create the material;
- show actionable failure and no material row when validation/finalization fails.

Organizer controls support edit, reorder, availability toggle/window, and remove. Public/approved event surfaces show only currently available resources allowed for the viewer. Restricted file links always point to the authorization route, never a durable storage URL.

## Projects

Shows event-linked projects with title, launch lead, team, tags, demo/GitHub/blog links, card status, queue status/position, pitched state, top/highlight state, and available pitch results.

Card status may be changed for reporting hygiene. UI copy explicitly avoids implying that card completion blocks pitching. A project identity links to the existing global project page and can appear independently in other event workspaces.

## Pitch

Shows current pitch-session phase, queue/project summary, timer/session availability, and an `Open pitch controller` action to `/pitch/[eventId]`.

The workspace does not embed or rebuild the controller. Site admin, in-scope chapter admin, MC, and co-MC can open it. Existing hacker voting/own-project behavior remains available through existing pitch surfaces.

## Public Event Project Entry

During the event and while its pitch is open, approved attendees, assigned staff, and site administrators see Add a project instead of the Pitch Session card. Other viewers and inactive events show no project-entry section.

The shared chooser shows New project first and Add existing project below it. Published projects owned by or shared with the viewer show event and pitch state. Projects already in the pitch queue show Already added. Event-only projects can still be added. A successful addition keeps the chooser open, shows a success message, and refreshes row state so the user can add another project.

New-project forms show current event choices with image, name, and chapter. An event without an uploaded image uses the standard event placeholder. Registered-user choices start selected. Site-admin choices start deselected. Contextual source events start selected. Users may clear every choice. The detailed contextual editor shows Publish without Save Draft and returns to `/pitch/[eventId]` after publication.

The project edit form shows the same current eligible event previews. Existing event links are selected, identified as already added, and cannot be removed from this additive control. An editor can select more current events. Saving an approved project creates the new event links without adding the project to a pitch queue.

The shared Add a project dialog uses an opaque theme background for its panel.

## Notes

Search/list includes only hackers relevant to this event. Selecting a hacker opens the shared current notepad and event context.

- Site admin, in-scope chapter admin, MC, co-MC: read/edit current body.
- Site admin and in-scope chapter admin: revision-history action.
- MC/co-MC: no history action; direct history request is denied.

Every surface warns that notes are internal and should not contain sensitive protected-class data without approved operational/legal need. Notes never appear in communications preview, public event pages, attendee views, project public views, or reporting preview.

## Reporting Preview

Shows available registration funnel, project-card/pitch/highlight, material, and communication delivery metrics. Full exports, sponsor reports, recaps, newsletter/social publishing, attendance, check-in, and no-show metrics are labeled future/unavailable rather than shown as zero.

## Common States And Accessibility

Every section defines loading, empty, unavailable, permission-lost, validation-error, and retryable-provider-error states. Tab/section navigation is keyboard accessible, uses visible focus, exposes current section semantics, and does not rely on color alone for role/status/visibility. Destructive staff/material/event actions require confirmation and preserve focus/status announcements after completion.
