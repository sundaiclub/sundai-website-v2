# UI Surface Contracts: Native Event Pages and RSVP

## Public And Hacker

### `/events`

Native Sundai event listing replacing the external calendar-centered public experience.

**Required behavior**

- Show upcoming published public events across all active chapters.
- Filter by chapter.
- Show title, chapter, public location summary, date/time in chapter timezone, public status, and signed-in viewer registration state when available.
- Hide unpublished events.
- Provide links to `/events/[chapterSlug]/[eventSlug]`.
- Do not expose approved-only details on cards.

### `/events/[chapterSlug]/[eventSlug]`

Public event detail page.

**Required behavior**

- Render title, chapter, date/time in chapter timezone, public description, public program/focus wording, public sponsor/expert text when provided, public location summary, application controls, current user status, cancellation controls when applicable, and add-to-calendar action.
- Anonymous users can view published public details and are prompted to sign in before applying.
- Signed-in eligible users can submit an application.
- Pending applicants can edit answers and cancel.
- Approved users see approved status and approved-only details.
- Waitlisted users see only that they are waitlisted.
- Declined users see configured public decline message only.
- Blocked users see only: "You are unable to register for this event at this time."
- Internal notes, moderation details, ban state, waitlist rank, and decision reasons never render.

### Public Application Form

Embedded in or launched from event detail.

**Required behavior**

- Renders one merged form in site, chapter, event question order.
- Prefills stable profile fields when available.
- Validates required fields before submit and shows field-level errors.
- Supports pending answer edit with original submitted timestamp preserved.
- Disables editing for approved, waitlisted, declined, blocked, and cancelled states.

### `/chapters`

Chapter directory.

**Required behavior**

- List active chapters.
- Show name, city, timezone, next event when available, and link to chapter page.
- Preserve Phase 1 private chapter visibility rules for signed-in users.

### `/chapters/[chapterSlug]`

Chapter page.

**Required behavior**

- Show chapter name, city, public description, upcoming published events, and mailing-list or subscribe CTA when available.
- Provide a useful Sundai-owned chapter experience without a custom homepage builder.
- Continue Phase 1 membership and invite behavior where present.

## Organizer

### `/organizer/events/new`

Event creation page for site admins and chapter admins.

**Required behavior**

- Site admins can create for any chapter.
- Chapter admins can create for their own chapters.
- MCs and co-MCs cannot create/publish by staff role alone.
- Capture chapter, title, slug, public description, public location summary, approved-only address/details, start/end time, timezone default from chapter, capacity, application mode, waitlist auto-promotion toggle default off, program/template, MCs, co-MCs, application questions, and public confirmation/waitlist/decline message text.
- Default application mode to approval-required.
- Allow immediate publish for authorized chapter admins and site admins.

### `/organizer/events/[eventId]/settings`

Event settings page.

**Required behavior**

- Site admins and chapter admins can edit all event configuration within scope.
- MC/co-MC settings access remains constrained by existing Phase 1 permissions.
- Shows current application open/closed state and controls for close/reopen where authorized.
- Shows capacity and waitlist auto-promotion setting.
- Shows public and approved-only detail fields separately.

### `/organizer/events/[eventId]/registrations`

Registration review queue.

**Required behavior**

- Tabs or filters for pending, approved, waitlisted, declined, and cancelled.
- Pending, approved, waitlisted, declined, and cancelled views exclude globally banned applicants for non-site-admins without any ban signal.
- Site-admin-only context can show blocked/banned registrations and ban state.
- Applicant row shows submitted answers, public status, internal review notes, current organizer note context, and decision controls allowed by role.
- MCs can approve, waitlist, decline, and add notes.
- Co-MCs can view context and add notes but cannot approve, waitlist, or decline.
- Chapter admins and site admins have full review ability in scope.
- Internal notes are visually and data-wise separate from public messages.

## Existing Pitch

### `/pitch` and `/pitch/[eventId]`

Keep existing pitch workspace behavior.

**Required behavior**

- Native public event pages may link to pitch workspace when relevant.
- Phase 2 does not replace the pitch queue.
- Pitch controls continue to use Phase 1 `EventStaff` and shared permission helpers.

## Explicitly Not Exposed

- Guest RSVP controls.
- QR check-in or scanner flows.
- Attendance migration UI.
- Historical external-event import controls.
- Public waitlist rank or estimated promotion order.
- Custom chapter landing page builder.
- Production email/SMS provider settings.
