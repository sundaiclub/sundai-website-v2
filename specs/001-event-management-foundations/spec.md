# Feature Specification: Event Management Foundations

**Feature Branch**: `001-event-management-foundations`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "docs/event-management-phase-1-plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Site Admin Delegates Chapter Operations (Priority: P1)

A site admin can establish chapters, control their public or private access, assign chapter admins, manage site-wide application requirements, and maintain global moderation controls so Sundai can operate across multiple cities without giving every organizer global power.

**Why this priority**: This is the foundation for the whole redesign because all chapter, event, moderation, and application workflows depend on clear site-level ownership.

**Independent Test**: Can be tested by signing in as a site admin, creating a public chapter and a private chapter, assigning and removing chapter admins, managing site-level application requirements, and confirming non-site-admins cannot perform those actions.

**Acceptance Scenarios**:

1. **Given** a signed-in site admin, **When** they create or update a chapter, **Then** the chapter records its public/private access mode, operating details, status, and assigned chapter admins.
2. **Given** a signed-in site admin, **When** they create or revoke a global ban, **Then** only site admins can see and manage the ban while normal organizer workflows reveal no ban-list signal.
3. **Given** a signed-in user without site-admin permission, **When** they attempt to manage site-wide chapters, bans, or required application fields, **Then** access is denied.

---

### User Story 2 - Chapter Admin Runs Local Chapter Operations (Priority: P1)

A chapter admin can manage their chapter, members, invitations, chapter-specific application questions, default declined-user messaging, and chapter events so local organizers can operate without waiting for a site admin.

**Why this priority**: Chapter admin delegation is the main operational unlock for multi-chapter event management.

**Independent Test**: Can be tested by assigning a user as a chapter admin, having them update only their chapter's settings, invite a hacker to a private chapter, manage members, configure chapter-level application questions, create an event, and verifying they cannot manage another chapter.

**Acceptance Scenarios**:

1. **Given** a chapter admin for one chapter, **When** they update chapter settings, members, invitations, and chapter-specific application questions, **Then** the changes apply only to that chapter.
2. **Given** a chapter admin for one chapter, **When** they try to manage another chapter's events, members, templates, or notes, **Then** access is denied unless they also hold a permission that grants access there.
3. **Given** a chapter admin identifies a hacker who may need moderation review, **When** they flag the hacker, **Then** a site-admin review item is created without creating a global ban or exposing the global ban list.

---

### User Story 3 - Hackers Join Chapters And Control Notification Permission (Priority: P1)

A signed-in hacker can discover active public chapters, join more than one public chapter, accept an invitation to a private chapter, see their membership state, and set whether each chapter may contact them later.

**Why this priority**: Chapter membership is the user-facing relationship that later RSVP, notification, and event discovery work will build on.

**Independent Test**: Can be tested by signing in as a hacker, joining two public chapters, accepting a private chapter invitation, updating notification preferences for each membership, and confirming a non-invited user cannot view a private chapter.

**Acceptance Scenarios**:

1. **Given** an active public chapter, **When** a signed-in hacker joins it, **Then** the hacker becomes an active member and can update chapter-specific notification permission and channel preferences.
2. **Given** a private chapter, **When** a signed-in hacker has an invitation, **Then** they can view the chapter and accept the invitation to become an active member.
3. **Given** a private chapter, **When** a user is not invited, not an active member, and not an authorized organizer, **Then** the chapter is hidden from them.

---

### User Story 4 - Event Staff Operates Assigned Events (Priority: P2)

Site admins and chapter admins can assign an MC and co-MC to events. Assigned MCs can manage event operations and review registrations when the review workflow exists, while co-MCs can support event operations without applicant decision power.

**Why this priority**: Existing event operations must keep working while the system introduces a clearer, event-scoped staff model.

**Independent Test**: Can be tested by assigning MC and co-MC roles to an event, confirming both can manage pitch operations, confirming MCs can edit assigned-event metadata, confirming co-MCs can edit operational resources, and confirming co-MCs cannot approve, waitlist, or decline applicants.

**Acceptance Scenarios**:

1. **Given** an event with assigned MCs and co-MCs, **When** those staff members manage current pitch operations, **Then** existing pitch behavior continues to work for their assigned event.
2. **Given** an assigned MC, **When** they edit operational event metadata or registration review state, **Then** the action is allowed for their assigned event only.
3. **Given** an assigned co-MC, **When** they attempt to approve, waitlist, or decline an applicant, **Then** the action is denied.

---

### User Story 5 - Organizers Use Internal Hacker Context Safely (Priority: P2)

Authorized organizers can view and update relevant internal hacker notes so review context is preserved, while note revision history and global moderation details remain limited to higher-trust roles.

**Why this priority**: The journey map identifies lost context and manual review as recurring operational pain points, but this information is sensitive and needs strict visibility boundaries.

**Independent Test**: Can be tested by creating an internal note for a hacker, verifying site admins and relevant chapter admins can view note history, verifying assigned MCs and co-MCs can view and edit the current note in relevant workflows, and verifying regular users cannot see notes.

**Acceptance Scenarios**:

1. **Given** a hacker has relevant organizer context for a chapter or event workflow, **When** an authorized organizer opens that workflow, **Then** they can view and update the current internal note body.
2. **Given** an organizer note has been edited, **When** a site admin or relevant chapter admin reviews note history, **Then** they can see the revision record.
3. **Given** a regular hacker or unauthorized organizer, **When** they try to view organizer notes or note history, **Then** access is denied.

---

### User Story 6 - Event And Application Foundations Exist For Later RSVP Work (Priority: P3)

Organizers can create and maintain richer event metadata, application templates, and internal registration records so later public RSVP and review experiences have a consistent foundation without exposing incomplete RSVP pages in this phase.

**Why this priority**: These foundations are necessary for later phases, but public RSVP and native public event discovery are explicitly outside this phase.

**Independent Test**: Can be tested by creating an event for an authorized chapter, composing site-required, chapter-default, and event-specific application questions, creating internal registration records, and confirming no new public RSVP flow is exposed.

**Acceptance Scenarios**:

1. **Given** a site admin or chapter admin, **When** they create an event for an authorized chapter, **Then** the event captures the metadata needed for later public event pages, registration, approval, check-in, and operational workflows.
2. **Given** site-required, chapter-default, and event-specific application questions, **When** an organizer previews the combined application requirements, **Then** site-required fields remain present and chapter questions may be supplemented by event questions.
3. **Given** Phase 1 is complete, **When** a public user browses the current event listing, **Then** they are not presented with a new native RSVP or application flow.

### Edge Cases

- If an existing event has a duplicate or invalid event identifier during migration, the system generates a unique readable identifier and marks the event for later cleanup.
- If a user is the only admin for a chapter, the system prevents them from leaving or being removed in a way that leaves the chapter without an admin.
- If a private chapter invitation is revoked before acceptance, the invited user can no longer view or join that private chapter through the invitation.
- If a globally banned user appears in a non-site-admin registration workflow, the user is excluded or blocked without revealing the existence or reason for the ban.
- If a chapter template attempts to remove a site-required field, the system rejects the change and keeps the required field in the composed application.
- If a user belongs to multiple chapters, membership status and notification preferences are tracked separately for each chapter.
- If an event has no assigned staff, site admins and authorized chapter admins retain management access.
- If organizer notes contain sensitive free text, they remain internal and are never exposed to regular users, public pages, outbound communications, or sponsor-facing outputs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a distinct site-admin role for global administration and MUST remove dependence on the previous single global admin role name for event-management permissions.
- **FR-002**: The system MUST support chapters as first-class operational units with name, public identifier, location details, timezone, description, status, and public or private access mode.
- **FR-003**: The system MUST backfill an initial Boston chapter and associate existing events with that chapter.
- **FR-004**: Site admins MUST be able to create, edit, pause, archive, view, and manage administrators for all chapters.
- **FR-005**: Chapter admins MUST be able to manage settings, members, invitations, chapter-level application questions, default declined-user messaging, and events for their own chapters.
- **FR-006**: The system MUST prevent chapter admins from managing chapters, members, events, templates, notes, and moderation records outside their authorized chapter scope.
- **FR-007**: Active public chapters MUST be visible to public users and joinable by signed-in users.
- **FR-008**: Private chapters MUST be visible only to invited users, active members, chapter admins for that chapter, and site admins.
- **FR-009**: Users MUST be able to belong to multiple chapters and have one membership state per chapter.
- **FR-010**: Chapter membership MUST record whether the chapter may contact the member later and MUST record channel preferences for future email and SMS notifications without sending notifications in this phase.
- **FR-011**: Users MUST be able to update notification permission and channel preferences for their active chapter memberships.
- **FR-012**: The system MUST support inviting users to private chapters, accepting invitations, revoking invitations, and tracking active, invited, revoked, and left membership states.
- **FR-013**: The system MUST support event-scoped staff assignments for MC and co-MC roles.
- **FR-014**: Existing pitch operations MUST continue to work for site admins, chapter admins for the event chapter, assigned MCs, and assigned co-MCs.
- **FR-015**: MCs MUST be able to manage assigned-event operational metadata and registration review workflows when those workflows exist.
- **FR-016**: Co-MCs MUST be able to manage assigned-event pitch operations and operational resources, but MUST NOT be able to approve, waitlist, or decline applicants.
- **FR-017**: Site admins and chapter admins MUST be able to create and edit events for authorized chapters and capture metadata needed for later registration, approval, check-in, location, capacity, visibility, and program workflows.
- **FR-018**: The system MUST preserve the current public event listing behavior and MUST NOT expose new public native RSVP, application, approved-detail, user RSVP status, or QR check-in pages in Phase 1.
- **FR-019**: The system MUST support a site-level application template with name and email as the default required fields.
- **FR-020**: The system MUST support one active chapter-level application template per chapter and allow chapter admins to extend site-required fields with local questions.
- **FR-021**: The system MUST allow event-specific application questions and MUST support previewing the combined site, chapter, and event question set.
- **FR-022**: The system MUST prevent chapter-level or event-level configuration from removing site-required application fields.
- **FR-023**: The system MUST allow event-level configuration to hide chapter-default questions while preserving site-required questions.
- **FR-024**: The system MUST support internal event registration and registration audit records for organizer/admin use without requiring public registration behavior in this phase.
- **FR-025**: Site admins MUST be able to create, view, and revoke permanent global bans with separate public-safe reason and internal note fields.
- **FR-026**: Chapter admins MUST be able to flag hackers for site-admin ban review, but MUST NOT be able to create, revoke, view, or count global bans.
- **FR-027**: Banned users MUST be blocked from later registration flows with only the generic message: "You are unable to register for this event at this time."
- **FR-028**: Non-site-admin organizer queues and workflows MUST hide globally banned users without exposing that a ban exists.
- **FR-029**: The system MUST support one current internal organizer note per hacker and an auditable revision history for note edits.
- **FR-030**: Site admins MUST be able to view all organizer notes and revisions.
- **FR-031**: Chapter admins MUST be able to view relevant organizer notes and revisions for hackers connected to their chapter workflows.
- **FR-032**: Assigned MCs and co-MCs MUST be able to view and edit relevant current organizer notes but MUST NOT be able to view note revision history.
- **FR-033**: Regular users MUST never be able to view organizer notes, organizer note revisions, ban records, internal ban flags, or internal applicant review notes.
- **FR-034**: The admin experience MUST provide a site-admin console, project moderation access, chapter management, application template management, global ban management, and organizer note access appropriate to each permission level.
- **FR-035**: The chapter and organizer experience MUST provide public chapter discovery, chapter landing pages, chapter settings, event creation, event listings for chapter/site admins, and event settings with permission-specific editing capabilities.
- **FR-036**: Permission checks for event-management surfaces MUST follow shared, consistent rules for site admins, chapter admins, chapter members, MCs, co-MCs, and regular users.
- **FR-037**: The system MUST include tests or equivalent validation for the core permission matrix, chapter visibility, chapter membership, event staff roles, pitch continuity, application template composition, global bans, organizer notes, and the site-admin role cutover.
- **FR-038**: Registration behavior tests, notification delivery tests, invite-only event behavior tests, Partiful historical import, and public RSVP replacement MUST remain outside Phase 1 scope.

### Key Entities *(include if feature involves data)*

- **Site Admin**: A user with global administrative authority across chapters, events, templates, bans, organizer notes, and project moderation.
- **Chapter**: A local Sundai community with operating details, status, and public or private access rules.
- **Chapter Membership**: The relationship between a hacker and a chapter, including role, status, invitation details, join state, and notification preferences.
- **Chapter Admin**: A chapter-scoped administrator who can operate one or more authorized chapters without global site-admin powers.
- **Event**: A chapter-owned gathering with operational metadata, visibility, capacity, timing, location summaries, approval-related details, application configuration, and pitch settings.
- **Event Staff Assignment**: An event-scoped assignment for MC or co-MC responsibilities.
- **Application Template**: A reusable set of application questions and required fields at the site or chapter level.
- **Event Registration**: An internal record representing a user's event application or RSVP state for future public registration workflows.
- **Registration Audit Record**: A history entry describing changes to an event registration.
- **Organizer Note**: Internal context about a hacker for authorized organizer workflows, with one current note body and a revision history.
- **Global Ban**: A permanent moderation record controlled only by site admins until revoked.
- **Ban Flag**: A chapter-admin-created review item asking site admins to evaluate whether a global ban is warranted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing events are associated with an initial chapter after migration, with duplicate or invalid event identifiers marked for cleanup.
- **SC-002**: Site admins can create a chapter, assign a chapter admin, and create an event for that chapter in 5 minutes or less during acceptance testing.
- **SC-003**: Chapter admins can create and publish an event for their own chapter without site-admin intervention in 4 minutes or less during acceptance testing.
- **SC-004**: 100% of private chapter visibility checks deny access to users who are not invited, active members, chapter admins for that chapter, or site admins.
- **SC-005**: 100% of non-site-admin global ban management attempts are denied and expose no ban-list counts or ban reasons.
- **SC-006**: Existing pitch workflows remain passable for site admins and assigned MCs, and become passable for assigned co-MCs, with no regression in current pitch control acceptance tests.
- **SC-007**: Application template composition always includes site-required name and email fields in acceptance tests, even when chapter or event questions are customized.
- **SC-008**: Organizer-note access tests pass for all role categories: site admin, relevant chapter admin, assigned MC, assigned co-MC, regular signed-in user, and signed-out user.
- **SC-009**: Regular hackers can join an active public chapter and update notification preferences in 2 minutes or less during acceptance testing.
- **SC-010**: Phase 1 ships with no new public RSVP/application/check-in user flow exposed to regular users.

## Assumptions

- Phase 1 is a cutover; long-term compatibility with the previous global admin role name is not required.
- The initial chapter backfill is Boston, with timezone `America/New_York`.
- Public chapter pages are lightweight discovery and membership pages, not custom marketing-site builders.
- Notification delivery is out of scope; Phase 1 only stores permission and channel preference state for later delivery.
- Phone number is not required in the default site-level application template because SMS delivery is not part of this phase.
- Registration records are internal scaffolding for later phases and do not require public submission behavior or registration behavior tests in Phase 1.
- Invite-only event behavior may be represented as future-ready event metadata, but no invite-only event user experience is required in Phase 1.
- The existing public event listing remains mostly unchanged until a later native event-discovery phase.
- "Relevant" organizer-note access for chapter admins means the hacker is connected to that chapter through a registration, staff assignment, project entry, or organizer workflow relation.
- Organizer notes are internal operational context and are never shown in public pages, outbound notifications, sponsor reports, public-safe decline messages, or user-facing exports.
- The canonical no-show behavior may move to a later attendance model; Phase 1 does not need to settle public attendance behavior.
