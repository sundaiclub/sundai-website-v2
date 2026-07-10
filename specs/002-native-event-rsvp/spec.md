# Feature Specification: Native Event Pages and RSVP

**Feature Branch**: `002-native-event-rsvp`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Phase 2 from GitHub issue #143: native event pages and RSVP after completion of Phase 1 in issue #142"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hackers Discover Published Events (Priority: P1)

A visitor or signed-in hacker can browse native Sundai event listings, filter by chapter, and open published event details so Sundai becomes the primary discovery surface for upcoming events.

**Why this priority**: Event discovery is the entry point for RSVP and application workflows and replaces the current external calendar-centered experience.

**Independent Test**: Can be tested by publishing events across multiple chapters, browsing the event listing, filtering by chapter, opening an event detail page, and confirming unpublished events and sensitive details are not exposed.

**Acceptance Scenarios**:

1. **Given** upcoming published events exist across multiple active chapters, **When** a visitor opens the event listing, **Then** they see each event's title, chapter, public location summary, date/time, public status, and a path to the event detail page.
2. **Given** a visitor selects a chapter filter, **When** the event listing refreshes, **Then** only published events for that chapter are shown.
3. **Given** an event has approved-only details, **When** an anonymous visitor or pending applicant views the event detail page, **Then** those details are hidden while public description, program/focus wording, public sponsor or expert text, public location summary, and application controls remain visible.

---

### User Story 2 - Hackers Apply, Track Status, And Cancel (Priority: P1)

A signed-in hacker can RSVP or apply to a published event, see their application status, edit answers while pending, and cancel their registration when needed.

**Why this priority**: Native RSVP/application submission is the central phase 2 user value and makes Sundai the source of truth for event participation.

**Independent Test**: Can be tested by signing in as a hacker, submitting an event application, viewing the submitted state, editing pending answers, canceling the registration, and confirming locked states prevent edits.

**Acceptance Scenarios**:

1. **Given** a signed-in hacker is eligible to apply to a published approval-required event, **When** they complete the application, **Then** the registration is created as pending and the user sees an "application submitted" state.
2. **Given** a pending applicant returns to the event page, **When** they update application answers, **Then** the updated answers are saved while the original submission timestamp remains the application timestamp.
3. **Given** an approved or declined applicant returns to the event page, **When** they try to edit application answers, **Then** answers remain locked and the status-specific message is shown.
4. **Given** a registered user cancels their own registration, **When** organizers review the event, **Then** the registration appears as cancelled and the public user no longer appears as actively attending or pending.

---

### User Story 3 - Organizers Create And Publish Chapter Events (Priority: P1)

A chapter admin can create, configure, and immediately publish an event for their chapter, while site admins can create and publish for any chapter.

**Why this priority**: The phase depends on local organizers being able to make events live without external publishing tools or site-admin bottlenecks.

**Independent Test**: Can be tested by signing in as a chapter admin, creating an event for the admin's chapter, configuring public and approved-only details, publishing it, and confirming unauthorized roles cannot publish.

**Acceptance Scenarios**:

1. **Given** a chapter admin is creating an event for their own chapter, **When** they provide the required event details and publish, **Then** the event becomes visible on public chapter and event listing pages immediately.
2. **Given** a site admin creates or edits an event for any chapter, **When** they publish it, **Then** the event follows the same public visibility, application, and sensitive-detail rules as chapter-published events.
3. **Given** an MC or co-MC does not have chapter-admin or site-admin authority, **When** they attempt to create or publish an event, **Then** the action is denied.

---

### User Story 4 - Organizers Review Applications Safely (Priority: P1)

Authorized organizers can review event registrations by status, use internal context, and make applicant decisions according to their role while banned applicant signals remain hidden from non-site-admin workflows.

**Why this priority**: Native applications are only useful if organizers can decide who attends without leaking sensitive moderation information or giving co-MCs decision power.

**Independent Test**: Can be tested with a pending applicant, assigned MC, assigned co-MC, chapter admin, site admin, and globally banned applicant to confirm each role sees and can act only within its permission boundary.

**Acceptance Scenarios**:

1. **Given** an assigned MC reviews pending applicants for their event, **When** they approve, waitlist, or decline an applicant, **Then** the applicant status updates and internal notes remain internal.
2. **Given** an assigned co-MC reviews applicants for their event, **When** they add notes or attempt a decision action, **Then** notes are allowed but approve, waitlist, and decline actions are denied.
3. **Given** a globally banned applicant exists for an event, **When** an MC, co-MC, or chapter admin opens normal registration queues, **Then** the applicant is hidden and no ban-list signal, count, reason, or moderation state is revealed.
4. **Given** a site admin opens the site-admin-only registration review context, **When** banned applicants exist, **Then** the site admin can see ban state and take site-admin-level moderation action.

---

### User Story 5 - Hackers See Chapter Pages (Priority: P2)

A visitor or hacker can browse a chapter directory and chapter page to find active chapters and upcoming events without each chapter needing a bespoke marketing homepage.

**Why this priority**: Chapter discovery supports multi-city growth and event filtering, but the core RSVP/review loop can still work before richer chapter highlights are added.

**Independent Test**: Can be tested by creating active chapters with upcoming published events, browsing the chapter directory, opening a chapter page, and confirming the page shows public chapter information and event links.

**Acceptance Scenarios**:

1. **Given** active chapters exist, **When** a visitor opens the chapter directory, **Then** they see each active chapter's name, city, timezone, next event if available, and link to the chapter page.
2. **Given** a chapter has upcoming published events, **When** a visitor opens the chapter page, **Then** they see the chapter name, city, public description, upcoming events, and mailing-list call to action if available.
3. **Given** a chapter has no custom standalone homepage, **When** the chapter page is viewed, **Then** the page still provides a consistent Sundai-owned chapter experience without requiring a custom landing page builder.

---

### User Story 6 - Organizers Manage Capacity, Closures, And Waitlist Movement (Priority: P2)

Organizers can manually close applications, manage approved capacity, place applicants on the waitlist, and optionally enable automatic waitlist promotion.

**Why this priority**: Capacity control prevents overbooking and gives organizers explicit control over applicant flow, while auto-promotion remains opt-in.

**Independent Test**: Can be tested by setting event capacity, closing and reopening applications, waitlisting applicants, canceling an approved registration, and verifying promotion behavior with auto-promotion disabled and enabled.

**Acceptance Scenarios**:

1. **Given** applications are manually closed for an event, **When** a new user attempts to apply, **Then** the user is blocked from submitting a new application and sees a public-safe closed-applications message.
2. **Given** waitlist auto-promotion is disabled, **When** an approved attendee cancels, **Then** capacity opens and organizers decide manually whether to approve a waitlisted applicant.
3. **Given** waitlist auto-promotion is enabled and capacity becomes available, **When** an approved attendee cancels, **Then** the oldest waitlisted registration is promoted if capacity allows and the user sees approved status.

### Edge Cases

- If an event is unpublished, it does not appear in public event listings, chapter pages, or direct public discovery surfaces.
- If an event is full but applications remain open, applicants can still be placed into pending or waitlisted states according to organizer decisions and event settings.
- If applications are manually closed before capacity is reached, all new applications are blocked until applications are reopened.
- If a user is already registered for an event, the event page shows their current status and prevents duplicate registrations.
- If a user belongs to one chapter, they can still RSVP or apply to events in other chapters unless a specific event or moderation rule blocks them.
- If a banned user attempts to register, the system blocks or excludes the registration through the site-admin-only moderation path and shows only the generic public-safe unable-to-register message.
- If a pending applicant edits answers, the original submission time is preserved while the answers and last-updated time reflect the edit.
- If an applicant is approved, approved-only details become visible only to that approved user and authorized organizers.
- If an applicant is waitlisted, the user sees that they are waitlisted but never sees waitlist rank or position.
- If a declined applicant views the event page, they see the configured public decline message and never see internal notes or decision reasons.
- If an organizer sends or previews public messaging, internal notes and moderation details are never included.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a native public event listing for upcoming published events across chapters.
- **FR-002**: Users MUST be able to filter the public event listing by chapter.
- **FR-003**: Event listing entries MUST show event title, chapter, public location summary, date/time in the chapter timezone, public status, and the signed-in user's RSVP/application state when available.
- **FR-004**: The system MUST provide public event detail pages for published events with public description, public program/focus wording, public sponsor or expert message text when provided, public location summary, application controls, current user status, cancellation controls when applicable, and an add-to-calendar action.
- **FR-005**: Approved-only event details MUST remain hidden from anonymous users, users without registrations, pending applicants, waitlisted users, declined users, and cancelled users.
- **FR-006**: Approved applicants MUST be able to view approved-only event details for their event.
- **FR-007**: The system MUST provide a chapter directory that lists active chapters with city, timezone, next event when available, and links to chapter pages.
- **FR-008**: The system MUST provide chapter pages with chapter name, city, public description, upcoming published events, and mailing-list or subscription call to action when available.
- **FR-009**: The system MUST NOT introduce custom standalone chapter marketing homepage creation in this phase.
- **FR-010**: Chapter admins MUST be able to create, configure, and immediately publish events for their own chapters.
- **FR-011**: Site admins MUST be able to create, configure, and immediately publish events for any chapter.
- **FR-012**: MCs and co-MCs MUST NOT be able to create or publish events unless they also hold a separate chapter-admin or site-admin permission.
- **FR-013**: Event creation MUST capture chapter, title, public identifier, public description, public location summary, approved-only details, start and end time, timezone, capacity, application mode, waitlist auto-promotion setting, program or template, MCs, co-MCs, application questions, and public confirmation, waitlist, and decline message text.
- **FR-014**: Approval-required application mode MUST be the default for every new event.
- **FR-015**: Waitlist auto-promotion MUST default to disabled for every new event.
- **FR-016**: The system MUST assemble each event application from site-required fields, chapter-level default fields, and event-level custom questions in that order.
- **FR-017**: The system MUST preserve enough application-question context at submission time for historical answers to remain understandable after templates change.
- **FR-018**: The system MUST validate required application fields at submission and when pending applicants edit answers.
- **FR-019**: The system MUST prefill stable profile information for known users when available and allow users to confirm or update it during application.
- **FR-020**: The system MUST NOT allow guest RSVPs or guest applications in this phase.
- **FR-021**: Eligible signed-in users MUST be able to apply to published events across chapters.
- **FR-022**: When a user submits an application for an approval-required event, the default public user-visible state MUST be pending.
- **FR-023**: Pending applicants MUST be able to edit application answers while keeping the original submission timestamp.
- **FR-024**: Approved and declined applicants MUST NOT be able to edit application answers.
- **FR-025**: Users MUST be able to cancel their own registration.
- **FR-026**: Users in waitlisted state MUST see only that they are waitlisted and MUST NOT see rank, position, or estimated promotion order.
- **FR-027**: Declined users MUST see the event's configured public decline message and MUST NOT see internal notes, moderation details, or private decision reasons.
- **FR-028**: Organizers MUST be able to manually close and reopen applications before capacity is reached.
- **FR-029**: Manual application closure MUST block all new applications while preserving organizer access to existing registrations.
- **FR-030**: Organizers MUST be able to review registrations through status views for pending, approved, waitlisted, declined, and cancelled registrations.
- **FR-031**: Assigned MCs MUST be able to approve, waitlist, decline, and add internal notes for applicants on assigned events.
- **FR-032**: Assigned co-MCs MUST be able to view assigned-event registration context and add internal notes, but MUST NOT be able to approve, waitlist, or decline applicants.
- **FR-033**: Chapter admins and site admins MUST have full review ability for events within their permitted chapter or site scope.
- **FR-034**: Decline communications and public decline views MUST use public message text and MUST NOT include internal notes.
- **FR-035**: Non-site-admin registration review queues MUST hide globally banned applicants without exposing any ban-list signal.
- **FR-036**: Chapter admins MUST receive no global-ban signal in normal RSVP or registration queues.
- **FR-037**: Site admins MUST be able to see banned users and ban state in site-admin-only review contexts.
- **FR-038**: Blocked or banned users MUST receive only the generic public-safe message: "You are unable to register for this event at this time."
- **FR-039**: If waitlist auto-promotion is enabled, the oldest waitlisted registration MUST be promoted when an approved attendee cancels and capacity allows.
- **FR-040**: If waitlist auto-promotion is disabled, approved cancellation MUST free capacity without automatically promoting a waitlisted registration.
- **FR-041**: The system MUST preserve a review history for status changes, cancellations, notes, application edits, and automatic waitlist promotions.
- **FR-042**: New public event pages SHOULD link to the existing pitch workspace where relevant, but this phase MUST NOT require replacing the pitch queue.
- **FR-043**: The system MUST NOT include check-in QR or scanner flows, attendance migration, historical external-event import, public waitlist rank, guest RSVPs, custom chapter landing page builder, or full pitch workspace replacement in this phase.
- **FR-044**: The system MUST include validation coverage for public event visibility, approved-only details, chapter-admin publishing, MC/co-MC review permissions, user cancellation, pending-answer edits, answer locks after decision, waitlist auto-promotion behavior, manual application closure, default approval-required mode, ban filtering, and application composition order.
- **FR-045**: When an applicant is approved or declined, the system MUST send the public-safe decision message through AWS SES email and/or Twilio SMS only when the applicant has an active membership in the event's chapter, has allowed notifications, has enabled that channel, and has a usable contact value.
- **FR-046**: Email or SMS delivery failure MUST NOT roll back or change the applicant's committed registration status or audit history.

### Key Entities *(include if feature involves data)*

- **Chapter**: A local Sundai community with public identity, city, timezone, description, active status, and upcoming events.
- **Event**: A chapter-scoped gathering with public discovery details, private approved-only details, timing, capacity, application settings, staff assignments, and public messaging.
- **Event Application**: The set of answers a signed-in user submits for an event, composed from site, chapter, and event questions.
- **Event Registration**: A user's participation record for an event with status such as pending, approved, waitlisted, declined, or cancelled.
- **Application Question Set**: The effective questions shown to a user for one event application, including required fields and historical context for interpreting answers.
- **Event Staff Assignment**: An event-scoped MC or co-MC assignment that controls review and note permissions.
- **Organizer Note**: Internal applicant context visible only to authorized organizers and excluded from all public messages.
- **Global Ban**: A site-admin-only moderation record that blocks or excludes a user from normal registration flows without exposing ban details to non-site-admins.
- **Waitlist Setting**: Event-level configuration controlling whether waitlisted users are manually reviewed or automatically promoted when capacity opens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of published upcoming events appear on native event listing and relevant chapter pages within normal page refresh behavior, while 0 unpublished events appear in public discovery.
- **SC-002**: A signed-in eligible hacker can find an event, submit an application, and see pending status in 3 minutes or less during acceptance testing.
- **SC-003**: 100% of approved-only detail checks hide sensitive event details from anonymous users and non-approved applicants and reveal them to approved applicants.
- **SC-004**: A chapter admin can create and publish an event for their chapter in 5 minutes or less without site-admin intervention.
- **SC-005**: 100% of tested MC decision actions succeed for assigned MCs and fail for assigned co-MCs without decision permission.
- **SC-006**: 100% of tested banned applicants are hidden from non-site-admin review queues and reveal no ban state, count, reason, or signal to MCs, co-MCs, or chapter admins.
- **SC-007**: Pending applicants can edit answers successfully in acceptance testing, while approved and declined applicants are blocked from edits in 100% of tested cases.
- **SC-008**: Manual application closure blocks 100% of new applications while allowing organizers to continue reviewing existing registrations.
- **SC-009**: With waitlist auto-promotion disabled, 0 tested cancellations automatically promote waitlisted users; with it enabled, the oldest eligible waitlisted user is promoted in 100% of tested capacity-opening cases.
- **SC-010**: The phase ships without guest RSVPs, check-in QR/scanner flows, attendance migration, historical external-event import, public waitlist rank, custom chapter homepage builder, or pitch queue replacement exposed to users.
- **SC-011**: 100% of tested approval and decline notifications honor the chapter-level master preference and individual email/SMS channel preferences, while simulated provider failures leave the committed decision unchanged.

## Assumptions

- Phase 1 foundations from issue #142 are complete, including chapters, event staff assignments, application templates, global bans, organizer notes, and shared permission rules.
- Boston remains the initial chapter, but phase 2 behavior is chapter-scoped and should work for additional active chapters.
- Google Calendar becomes a downstream output later; it is not the authoring or primary discovery surface for this phase.
- Past event archives are not part of the core phase 2 requirement unless already exposed through chapter pages or later reporting work.
- Mailing-list signup on chapter pages can be represented as a call to action even if the final provider is not chosen yet.
- Approval and decline decisions are sent through AWS SES email and Twilio SMS according to the applicant's active chapter-membership notification preferences and available contact information; in-product status remains authoritative if delivery fails.
- Declined users receive organizer-configured public decline message text, not a globally fixed message.
- Blocked or banned users receive the existing generic public-safe unable-to-register message unless a later policy explicitly changes it.
- Historical external-event import is intentionally out of scope for this phase.
- Existing pitch workflows may continue alongside native event pages, and phase 2 does not require merging organizer event management with the pitch workspace.
