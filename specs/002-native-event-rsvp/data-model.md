# Data Model: Native Event Pages and RSVP

## Existing Entities Changed

### Chapter

Local Sundai community and event-discovery grouping.

**Phase 2 usage**

- Public directory lists active chapters.
- Chapter page lists upcoming published events.
- `mailingListName` and `mailingListExternalId` support a mailing-list CTA when configured.

**Validation rules**

- Public users see active public chapters.
- Private chapters remain visible only to invited users, active members, chapter admins, and site admins.

### Event

Chapter-scoped event shown on public listings and used for public registration.

**Existing fields used**

- `chapterId`
- `slug`
- `title`
- `description`
- `startTime`
- `endTime`
- `venueName`
- `publicLocation`
- `address`
- `virtualUrl`
- `status`
- `visibility`
- `programType`
- `publicProgramLabel`
- `capacity`
- `approvedDetailsJson`
- `applicationQuestionsJson`
- `hideChapterDefaultQuestions`
- `autoPromoteWaitlist`
- `applicationsCloseReason`

**Required cutover field changes**

- Replace `applicationMode` values with public semantics:
  - `REQUIRES_APPROVAL`
  - `OPEN_RSVP`
- Change default `applicationMode` to `REQUIRES_APPROVAL`.
- Replace ambiguous nullable `applicationsOpen DateTime?` with explicit state:
  - `applicationsOpen Boolean @default(true)`
  - `applicationsClosedAt DateTime?`
  - `applicationsClosedById String?`
  - `applicationsCloseReason String?`

**Relationships**

- Belongs to one `Chapter`.
- Has many `EventStaff`.
- Has many `EventRegistration`.
- Has many `EventRegistrationAudit`.
- May have linked `PitchSession` records.

**Validation rules**

- `(chapterId, slug)` is unique.
- Public discovery includes only `status = PUBLISHED`, `visibility = PUBLIC`, upcoming events unless archive behavior is explicitly added later.
- Public listing/detail responses show public fields only.
- `approvedDetailsJson`, `address`, `virtualUrl`, and other sensitive resources are visible only to approved registrants and authorized organizers.
- Chapter timezone is used for public display.
- New events default to `applicationMode = REQUIRES_APPROVAL` and `autoPromoteWaitlist = false`.
- Manual closure blocks new submissions regardless of capacity.

### ApplicationTemplate

Site and chapter application field definitions from Phase 1.

**Phase 2 usage**

- Public application form is composed from active site template, active chapter template, and event-level questions in that order.
- Existing composition helper remains the canonical merge behavior.

**Validation rules**

- Site-required fields cannot be removed or weakened.
- Event-level fields cannot override site-required fields.
- Server validates required fields against the submitted snapshot.

### EventRegistration

User participation record for one event.

**Existing fields used**

- `eventId`
- `hackerId`
- `status`
- `source`
- `answersJson`
- `templateSnapshotJson`
- `publicSafeMessage`
- `internalReviewNotes`
- `decidedById`
- `decidedAt`
- `createdAt`
- `updatedAt`

**Required cutover field changes**

- Replace `EventRegistrationSource.PUBLIC_LATER` with `WEBSITE`.
- Add `submittedAt DateTime @default(now())` so pending answer edits can preserve the application timestamp even while `updatedAt` changes.
- Add `cancelledAt DateTime?` and `cancelledById String?` for user cancellation and organizer cancellation audit context.
- Optionally add `waitlistedAt DateTime?` if implementation needs deterministic waitlist ordering independent of initial submission time.

**Statuses**

- `PENDING`
- `APPROVED`
- `WAITLISTED`
- `DECLINED`
- `BLOCKED`
- `CANCELLED`

**Validation rules**

- Unique registration per `(eventId, hackerId)`.
- Public registration requires a signed-in hacker.
- No guest registrations.
- Approval-required submissions become `PENDING`.
- Open RSVP submissions may become `APPROVED` immediately if capacity allows; otherwise they become `WAITLISTED` or `PENDING` according to event policy.
- Pending applicants may edit answers; `submittedAt` remains unchanged and `updatedAt` changes.
- Approved, declined, waitlisted, blocked, and cancelled users cannot edit answers.
- Approved users can see approved-only details.
- Waitlisted users cannot see rank or estimated promotion order.
- Declined users see only event-configured public decline message.
- Blocked users see only: "You are unable to register for this event at this time."

### EventRegistrationAudit

History record for registration creation, edits, decisions, cancellation, notes, and auto-promotion.

**Existing fields used**

- `registrationId`
- `eventId`
- `actorId`
- `fromStatus`
- `toStatus`
- `changeJson`
- `createdAt`

**Validation rules**

- Write an audit entry for public submission, pending answer edit, status decision, internal note update, cancellation, manual close/open impact where relevant, and automatic waitlist promotion.
- Public users never read audit records.
- Internal notes and moderation details never appear in public responses.

### EventStaff

Event-scoped MC/co-MC assignment from Phase 1.

**Phase 2 usage**

- MCs can review assigned event registrations and approve, waitlist, or decline applicants.
- Co-MCs can view assigned event registration context and add notes, but cannot approve, waitlist, or decline.

### UserBan

Global site-admin-only moderation record from Phase 1.

**Phase 2 usage**

- Public registration submission checks active global bans.
- Non-site-admin queues hide banned applicants without counts, reasons, or signals.
- Site-admin-only review can include blocked/banned registrations and ban state.

## New Logical Entities

### Public Event Listing Item

Response shape for event cards.

**Fields**

- `id`
- `slug`
- `chapterSlug`
- `chapterName`
- `title`
- `publicLocation`
- `startTime`
- `endTime`
- `timezone`
- `publicStatus`
- `viewerRegistrationStatus`

**Validation rules**

- Does not include approved-only fields.
- Does not expose banned or blocked state beyond the generic user-facing message when applicable.

### Public Event Detail

Response shape for `/events/[chapterSlug]/[eventSlug]`.

**Fields**

- Event public fields from listing item.
- `description`
- `publicProgramLabel`
- public sponsor/expert text if represented in event metadata.
- application controls state.
- current user registration state.
- add-to-calendar payload.
- approved-only details only when viewer is approved or an authorized organizer.

**Validation rules**

- Anonymous users can read published public details but cannot submit without sign-in.
- Unpublished events are hidden from public discovery and direct public access.

### Application Question Set

Rendered application fields for one event application.

**Fields**

- `siteFields`
- `chapterFields`
- `eventFields`
- `composedFields`
- `snapshotVersion` or equivalent metadata

**Validation rules**

- Composition order is site, chapter, event.
- Snapshot is stored with each submission and edit.
- Required fields are validated server-side.

### Registration Review View

Organizer-facing filtered view of event registrations.

**Fields**

- `status`
- applicant summary
- application answers
- internal review notes
- current organizer note body
- decision metadata
- audit summary when authorized

**Validation rules**

- Site admins and chapter admins have full review in scope.
- Assigned MCs can decide.
- Assigned co-MCs can note only.
- Non-site-admin views hide globally banned applicants.
- Site-admin-only context may show blocked registrations and ban state.

### Waitlist Promotion

Transactional operation that promotes a waitlisted registration when capacity opens.

**Fields**

- `eventId`
- `triggeringRegistrationId`
- `promotedRegistrationId`
- `actorId` nullable for automatic action
- `promotionReason`

**Validation rules**

- Runs only when `autoPromoteWaitlist = true`.
- Runs only when approved count is below capacity.
- Selects oldest eligible waitlisted registration.
- Writes an audit record that marks the promotion automatic.
