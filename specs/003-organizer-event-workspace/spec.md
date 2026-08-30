# Feature Specification: Organizer Event Workspace

**Feature Branch**: `003-event-workspace`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Phase 4 from GitHub issue #145, using parent issue #147 and its linked phase issues for context. Phase 3 in issue #144 is intentionally skipped because it is optional for the next steps and will be redesigned."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Organizers Run an Event From One Workspace (Priority: P1)

An authorized organizer can open one event workspace, understand the event's current operational state, and move between event details, registrations, communications, materials, projects, pitch controls, notes, and a reporting preview without reconstructing context across disconnected tools.

**Why this priority**: A single operational home is the primary value of this phase and is the foundation for every other organizer workflow.

**Independent Test**: Can be tested by assigning each organizer role to an event, opening the workspace, verifying its overview and navigation, and confirming each role sees only the actions and information permitted for that event.

**Acceptance Scenarios**:

1. **Given** a site admin, chapter admin, MC, or co-MC has access to an event, **When** they open its organizer workspace, **Then** they see the event identity, status, chapter, schedule, capacity, application settings, staff, public link, approved-only detail state, and available operational sections.
2. **Given** current registration and project information exists, **When** an authorized organizer views the overview, **Then** they see current counts for registration statuses, project cards, and pitch activity supported by completed phases.
3. **Given** an organizer lacks access to the event, **When** they attempt to open the workspace, **Then** no organizer data or actions are revealed.
4. **Given** phase 3 check-in and attendance work is deferred, **When** an organizer opens the workspace, **Then** no check-in workflow or attendance-derived count is presented as available or authoritative.

---

### User Story 2 - Organizers Manage Event Materials (Priority: P1)

Authorized organizers can keep event resources together, using uploads or links and assigning each resource an audience so public information, approved-attendee information, and organizer-only material are not mixed.

**Why this priority**: Centralized, permissioned resources replace a major spreadsheet and shared-drive pain point while protecting sensitive event details.

**Independent Test**: Can be tested by creating uploaded and linked materials at each visibility level, viewing them as an organizer, approved attendee, pending attendee, and anonymous visitor, then editing and removing them.

**Acceptance Scenarios**:

1. **Given** an authorized organizer adds a link or supported file, **When** they select public, approved-attendee, or organizer-only visibility, **Then** the material is saved with that audience and appears in the event workspace.
2. **Given** an approved-attendee material exists, **When** an approved attendee views event resources, **Then** they can access it while pending, waitlisted, declined, cancelled, and anonymous users cannot.
3. **Given** an organizer-only material exists, **When** any attendee or public visitor views the event, **Then** the material and its metadata are not exposed.
4. **Given** an upload violates the displayed material policy, **When** an organizer attempts to add it, **Then** the material is rejected with a clear explanation and no partial record is created.

---

### User Story 3 - Organizers Communicate With Registration Audiences (Priority: P1)

Authorized organizers can draft and send event messages to clearly defined registration audiences, with recipient consent and channel eligibility enforced and an immutable record of who was targeted and what happened.

**Why this priority**: Auditable event communication is required to replace ad hoc exports and external event blasts safely.

**Independent Test**: Can be tested by creating registrations in each supported status, sending through each enabled channel, changing statuses afterward, and confirming recipients, exclusions, consent enforcement, and delivery history remain correct.

**Acceptance Scenarios**:

1. **Given** registrations have different current statuses, **When** an authorized organizer selects a supported status audience and previews a message, **Then** the preview shows the exact eligible recipient count and excludes cancelled, blocked, ineligible, or non-consenting recipients as applicable.
2. **Given** the organizer confirms a message, **When** it is sent, **Then** the system preserves the sender, content, channel, audience definition, recipient snapshot, and recipient-level delivery outcome.
3. **Given** registration statuses change after a message is sent, **When** an organizer reviews its history, **Then** the original recipient snapshot remains unchanged.
4. **Given** a recipient has not consented to SMS or lacks a usable contact value, **When** an SMS audience is prepared, **Then** that recipient is excluded and the organizer sees an aggregate explanation without private moderation data.

---

### User Story 4 - Organizers Share Internal Hacker Notes Safely (Priority: P2)

Organizers with relevant event access can read and update the shared internal notepad for a hacker, while only chapter admins and site admins can inspect its edit history.

**Why this priority**: Shared operational context helps organizers coordinate across registration and event workflows, but its privacy boundary must be reliable.

**Independent Test**: Can be tested by updating one hacker's note as each organizer role, reading it from relevant event contexts, checking revision-history permissions, and verifying it never appears in public or attendee-facing output.

**Acceptance Scenarios**:

1. **Given** an organizer has relevant event access to a hacker, **When** they view the hacker in registration, project, or notes contexts, **Then** they see the same current shared notepad body.
2. **Given** an authorized organizer edits the notepad, **When** the update is saved, **Then** all authorized organizer contexts show the new body and the change is recorded with editor and time.
3. **Given** an MC or co-MC views a hacker note, **When** they request its edit history, **Then** the history is denied while the current note remains available.
4. **Given** public pages, attendee responses, event messages, or exports are produced, **When** they include hacker or event data, **Then** organizer notes and revision metadata are excluded.

---

### User Story 5 - Organizers Coordinate Projects and Pitching (Priority: P2)

Organizers can see projects attached to the event, understand project-card readiness and pitch state, and access the existing pitch controls from the event workspace without imposing new participation gates.

**Why this priority**: Connecting existing project and pitch operations completes the workspace while preserving a workflow that already serves hackers and organizers.

**Independent Test**: Can be tested by attaching the same project to multiple events, updating event-specific project state, opening pitch controls as each role, and confirming existing hacker voting and project behavior remains intact.

**Acceptance Scenarios**:

1. **Given** projects are attached to an event, **When** an organizer opens the projects section, **Then** they see the project, team, launch lead, links, card readiness, queue state, pitch outcome, and highlight state available for that event.
2. **Given** the same project participates in multiple events, **When** organizers view either workspace, **Then** the shared project remains one project while each event retains its own participation and pitch state.
3. **Given** a site admin, chapter admin, MC, or co-MC opens pitch controls for an authorized event, **When** they manage the queue or pitch session, **Then** their existing pitch-control capabilities remain available.
4. **Given** a project card is incomplete, **When** a hacker or organizer enters the pitch workflow, **Then** this phase does not add a new blocking gate beyond existing pitch rules.

---

### User Story 6 - Administrators Control Event Staff and Lifecycle Actions (Priority: P2)

Site admins and chapter admins can manage event staff and lifecycle actions within their scope, while MCs and co-MCs retain operational access without receiving administrative authority.

**Why this priority**: Clear administrative boundaries prevent event-scoped operational roles from silently gaining publishing or staffing power.

**Independent Test**: Can be tested by attempting staff assignment, event detail changes, and publish, unpublish, or cancel actions as each role across in-scope and out-of-scope chapters.

**Acceptance Scenarios**:

1. **Given** a site admin or the event's chapter admin manages an event, **When** they add or remove MCs and co-MCs, **Then** workspace access changes accordingly and the staff list reflects the change.
2. **Given** an MC or co-MC has event access but no separate admin role, **When** they attempt to assign staff or change the event lifecycle, **Then** the action is denied.
3. **Given** a chapter admin attempts to manage an event outside their chapter, **When** they request an administrative action, **Then** the action is denied without exposing private workspace information.

---

### User Story 7 - Attendees Add Projects From an Active Event (Priority: P1)

Approved attendees, event staff, and site administrators can add a published project or start a new project from an event that is happening now.

**Why this priority**: Project submission must be available in the event context without sending attendees to a separate pitch page.

**Independent Test**: Open an active event as each supported viewer, add an existing project, create and publish a new project with event choices, and verify event and pitch participation, visibility, and return navigation.

**Acceptance Scenarios**:

1. **Given** an event and pitch session are active, **When** an approved attendee, assigned staff member, or site administrator opens the public event page, **Then** they see an Add a project section instead of the pitch-session link.
2. **Given** an eligible viewer opens the project chooser, **When** they inspect their published projects, **Then** existing pitch entries are marked Already added and event-only projects remain available to add to the pitch queue.
3. **Given** a user starts a new project from an event or pitch page, **When** the project form opens, **Then** the source event is selected and shown with its image, name, and chapter.
4. **Given** a user publishes a new project, **When** selected events are submitted, **Then** the project joins those events and joins only the open source pitch queue.
5. **Given** the source pitch closes before publication, **When** the user publishes, **Then** publication and event participation succeed but no pitch entry is created.
6. **Given** a site administrator opens normal project creation, **When** current events load, **Then** all current events are available and none are selected by default.

### Edge Cases

- If an event has no registrations, projects, materials, notes, or messages, the workspace shows useful empty states rather than errors or misleading zero-derived conclusions.
- If an organizer loses their staff assignment while the workspace is open, their next read or write is denied and no stale permission is honored.
- If the same hacker has organizer roles through more than one path, the most permissive valid role applies only within its chapter or event scope; it never expands to unrelated events.
- If a message audience changes between preview and send, recipients are recalculated at send time and the sender is shown the final audience before confirmation.
- If some recipients fail delivery, successful deliveries and failures are recorded independently; failures do not rewrite the recipient snapshot or registration status.
- If an event is cancelled, previously sent communication history and materials remain available to authorized organizers, while new actions follow the cancelled-event policy.
- If a material is removed, prior message records that referenced it remain auditable without restoring access to the removed material.
- If an organizer attempts to expose an organizer-only material through a public message, the system prevents the restricted resource from being sent as publicly accessible content.
- If a hacker is globally blocked, non-site-admin organizers do not see the hacker, a hidden count, or ban information through workspace audiences, notes, registrations, projects, or exports.
- If phase 3-derived concepts such as checked-in attendees or no-shows are requested, the workspace treats them as unavailable until the redesigned check-in and attendance phase is specified and delivered.
- If an event or pitch ends while a contextual project draft is being edited, publication still succeeds and the project joins the selected event, but it does not join the closed pitch queue.
- If an existing project is already linked to an event but not its pitch queue, it remains available for pitch submission.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide one organizer workspace per event for authorized site admins, chapter admins, MCs, and co-MCs.
- **FR-002**: The workspace MUST provide access to overview, registrations, communications, materials, projects, pitch, notes, and reporting-preview information that is available from completed phases.
- **FR-003**: The workspace overview MUST show event title, status, chapter, start and end time, capacity, application mode, waitlist auto-promotion state, assigned MCs and co-MCs, public event link, and approved-only detail state.
- **FR-004**: The workspace overview MUST show current registration counts by supported status and current project-card and pitch counts without exposing globally blocked registrations to non-site-admin roles.
- **FR-005**: Site admins MUST be able to access and administratively manage any event workspace.
- **FR-006**: Chapter admins MUST be able to access and administratively manage event workspaces only for their chapters.
- **FR-007**: Assigned MCs MUST be able to edit event settings and manage event operations, communications, materials, projects, pitch controls, organizer notes, and applicant decisions for their assigned events.
- **FR-008**: Assigned co-MCs MUST be able to manage event operations, communications, materials, projects, pitch controls, and organizer notes for their assigned events, but MUST NOT approve, waitlist, decline, block, or otherwise decide applicants.
- **FR-009**: MC and co-MC assignments alone MUST NOT grant staff-assignment, publishing, unpublishing, cancellation, application open/close, or cross-event administrative authority; co-MC assignments alone MUST NOT grant event-settings edit authority.
- **FR-010**: Site admins and in-scope chapter admins MUST be able to assign and remove event MCs and co-MCs.
- **FR-011**: All workspace reads and writes MUST verify the organizer's current role and current event or chapter scope at the time of the action.
- **FR-012**: The workspace MUST integrate the completed registration-review experience so organizer role boundaries and global-ban filtering remain unchanged.
- **FR-013**: The system MUST allow authorized organizers to create event materials as either supported file uploads or URL links.
- **FR-014**: Every material MUST have exactly one visibility level: public, approved attendees, or organizers only.
- **FR-015**: Public materials MUST be accessible through the public event experience; approved-attendee materials MUST be accessible only to approved registrants and authorized organizers; organizer-only materials MUST be accessible only to authorized organizers.
- **FR-016**: Authorized organizers MUST be able to edit material metadata, visibility, ordering, and availability and to remove materials.
- **FR-017**: The material workflow MUST display the active upload size and type policy before selection and MUST reject nonconforming uploads without creating a partial material.
- **FR-018**: Material access checks MUST apply to both the material listing and the underlying content so a hidden material cannot be retrieved by knowing its address.
- **FR-019**: Authorized organizers, including assigned MCs and co-MCs, MUST be able to draft, preview, and send event communications through enabled email and SMS channels.
- **FR-020**: Supported communication audiences for this phase MUST include active registered users, pending, approved, waitlisted, declined, and explicitly selected eligible users.
- **FR-021**: Status-based audiences MUST be resolved from registration state at send time and MUST exclude cancelled and globally blocked users unless a site-admin-only policy explicitly selects an otherwise eligible user.
- **FR-022**: Before send confirmation, the system MUST show the sender the channel, message content, audience definition, final eligible recipient count, and aggregate exclusions.
- **FR-023**: SMS communications MUST be limited to recipients with recorded consent, an enabled SMS preference, and a usable phone number.
- **FR-024**: Email communications MUST be limited to recipients with an enabled email preference and a usable email address.
- **FR-025**: Each sent communication MUST preserve its creator, sender, message content, audience definition, channel, send time, immutable recipient snapshot, and recipient-level sent or failed outcome.
- **FR-026**: A partial or total delivery failure MUST NOT alter registration status, the intended recipient snapshot, or successful delivery records.
- **FR-027**: Communication content and recipient data MUST NOT expose organizer notes, global-ban data, internal review reasons, or organizer-only materials to recipients.
- **FR-028**: The workspace MUST provide the current shared organizer notepad for hackers relevant to the organizer's permitted event workflows.
- **FR-029**: Authorized site admins, chapter admins, MCs, and co-MCs MUST be able to update the current organizer-note body when the hacker is relevant to their permitted event workflow.
- **FR-030**: Every organizer-note update MUST preserve the editor, edit time, and enough change history to review prior edits.
- **FR-031**: Only site admins and chapter admins with relevant scope MUST be able to view organizer-note edit history; MCs and co-MCs MUST see only the current body.
- **FR-032**: Organizer notes and their history MUST be excluded from public pages, attendee-facing responses, communications, public-safe exports, and future sponsor-facing outputs.
- **FR-033**: The workspace MUST list projects attached to the event with available team, launch lead, tags, links, card-readiness, pitch-queue, pitched, and highlighted information.
- **FR-034**: A project MUST be able to participate in multiple events without being duplicated, while event-specific project and pitch state remains independently manageable.
- **FR-035**: Site admins, in-scope chapter admins, assigned MCs, and assigned co-MCs MUST retain full organizer pitch-control permissions for authorized events.
- **FR-036**: This phase MUST preserve existing hacker project and voting behavior and MUST NOT add a new project-card completion gate to pitching.
- **FR-037**: The workspace MUST provide direct access to existing pitch capabilities from the event context without requiring organizers to rediscover the event elsewhere.
- **FR-038**: The reporting preview MUST identify later reporting outputs and show only metrics supported by completed phases; it MUST NOT present deferred attendance metrics as authoritative.
- **FR-039**: The system MUST provide clear empty, unavailable, loading, and failure states for every workspace section without leaking restricted data.
- **FR-040**: Globally blocked users and ban details MUST remain hidden from MCs, co-MCs, and chapter admins in registrations, audience construction, notes, projects, counts, and exports.
- **FR-041**: The system MUST preserve an auditable record of staff changes, communication sends, material changes, applicant decisions, and organizer-note edits with the acting user and time.
- **FR-042**: Phase 3 check-in and attendance functionality from issue #144 MUST NOT be implemented as part of this feature; it is intentionally deferred for redesign.
- **FR-043**: Until the redesigned phase 3 is specified and delivered, the workspace MUST NOT offer a check-in workflow or checked-in/no-show communication audiences and MUST NOT treat legacy week-based attendance as event attendance.
- **FR-044**: This phase MUST NOT rebuild pitch behavior, automate social or newsletter publication, add guest workflows, expose ban management to MCs or co-MCs, automate rejection from organizer notes, import historical external-event data, or add sponsor access.
- **FR-045**: Project creation MUST NOT infer event participation from chapter membership or other hidden context.
- **FR-046**: The new-project flow MUST show events happening now for which the user has an approved, non-cancelled registration; site administrators MUST see all events happening now.
- **FR-047**: Eligible events MUST be shown with event image, event name, and chapter name; the standard event placeholder MUST be shown when an event has no image; eligible registered-user events MUST be selected by default and site-admin events MUST be deselected by default.
- **FR-048**: Users MUST be able to select no events or any subset of the shown events.
- **FR-049**: Selected event participation MUST be created when the project is published, not when its draft is created.
- **FR-050**: Normal project creation MUST add the published project only to selected events and MUST NOT add it to pitch queues.
- **FR-051**: Contextual creation from an event or pitch page MUST add the published project to the source pitch queue only when the source event remains selected and its pitch session is open.
- **FR-052**: Closing the source pitch before publication MUST NOT block project publication or selected event participation.
- **FR-053**: The active public event page MUST replace its Pitch Session section with an Add a project section for approved attendees, assigned staff, and site administrators; the section MUST be absent outside the event duration or after the pitch session finishes.
- **FR-054**: The event and pitch project chooser MUST show a New project action above the user's published projects, identify projects already in the pitch queue, and allow event-only projects to join the queue.
- **FR-055**: Adding a project to a pitch session linked to an event MUST also attach the project to that event atomically and MUST keep the chooser open with a success message.
- **FR-056**: Contextual project editing MUST remove the Save Draft action, retain Publish, and return to the source pitch page after publication.
- **FR-057**: Draft projects MUST NOT appear in the public event project carousel.
- **FR-058**: The project edit page MUST show current eligible events, identify events that already contain the project, and let an authorized editor add an approved project to additional selected events without adding it to their pitch queues.

### Key Entities _(include if feature involves data)_

- **Organizer Event Workspace**: The event-scoped operational view that assembles overview, registrations, communications, materials, projects, pitch, notes, and reporting-preview capabilities according to the current organizer's role.
- **Event Staff Assignment**: An event-scoped MC or co-MC relationship controlling operational access, with applicant-decision authority reserved for MCs.
- **Event Material**: An uploaded file or URL resource with event ownership, display metadata, ordering, availability, and one visibility level.
- **Event Communication**: A draft or sent event message with content, channel, audience definition, creator, sender, and send state.
- **Communication Recipient Snapshot**: The immutable set of eligible recipients selected at send time, including recipient-level delivery results without later registration changes rewriting history.
- **Organizer Note**: One shared current notepad per hacker, visible only in relevant organizer contexts and backed by restricted edit history.
- **Event Project Participation**: The relationship connecting a reusable project to an event, including event-specific card readiness, pitch state, outcome, and highlight state.
- **Audit Record**: A timestamped record of a significant organizer action and its actor, retained for operational accountability.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of authorized site admins, in-scope chapter admins, assigned MCs, and assigned co-MCs can reach all workspace sections permitted to their role from one event context, while unauthorized users reach none.
- **SC-002**: An authorized organizer can find the event's current status, staffing, application settings, registration counts, project counts, and public event link within 60 seconds of opening the workspace.
- **SC-003**: 100% of tested material access combinations enforce public, approved-attendee, and organizer-only visibility at both listing and retrieval time.
- **SC-004**: An organizer can add and classify a valid event material in under 2 minutes, while 100% of tested invalid uploads are rejected without partial records.
- **SC-005**: For every tested communication, the final audience matches eligible registration status and channel preferences at send time, with 0 cancelled, blocked, or non-consenting recipients contacted through a disallowed channel.
- **SC-006**: 100% of sent communication tests preserve the original recipient snapshot and recipient-level result after later registration changes or partial delivery failures.
- **SC-007**: 100% of tested organizer-note surfaces show the same current note to authorized organizers, expose revision history only to permitted admins, and reveal no note data in public or attendee-facing outputs.
- **SC-008**: 100% of tested MC applicant decisions succeed for authorized MCs and fail for co-MCs who lack a separate admin role, while both roles retain their permitted operational tools.
- **SC-009**: The same project can participate in at least three test events with independent event-specific pitch state and no duplicate project identity.
- **SC-010**: Existing pitch-control and hacker voting acceptance scenarios continue to pass with no new project-card completion gate.
- **SC-011**: 100% of tested staff, material, message, applicant-decision, and organizer-note changes identify the actor and action time in the appropriate audit history.
- **SC-012**: The delivered workspace contains no functional check-in, checked-in/no-show audience, or event-attendance claim derived from the deferred phase 3 or legacy week attendance.
- **SC-013**: At least 90% of organizers in a task-based usability review can locate an event resource, registration queue, communication history, hacker note, project list, and pitch controls on their first attempt without assistance.
- **SC-014**: In acceptance testing, 100% of project publications create exactly the selected event participations and create no non-source pitch entries.
- **SC-015**: In acceptance testing, the active-event Add a project section is visible to every approved attendee, assigned staff member, and site administrator and to no other viewer.

## Assumptions

- Phase 1 foundations from issue #142 and phase 2 native event and registration workflows from issue #143 are complete and are dependencies of this feature.
- Phase 3 from issue #144 is intentionally skipped because it is optional for phase 4 and phase 5 progress; its check-in and attendance design will be replaced by a future specification.
- Skipping phase 3 means check-in controls, event-native attendance, checked-in/no-show audiences, attendance counts, and attendance exports are outside this feature even where issue #145 originally listed them as workspace tabs or metrics.
- The workspace will expose only completed capabilities; it will not create a compatibility layer over legacy week-based attendance.
- Existing project and pitch capabilities remain the source of truth for pitching. This phase reuses the project chooser while a later feature will move the pitch controller into an event-page tab.
- Approval and decline communication behavior from phase 2 remains intact. Event blasts use the same established email/SMS channel preferences and consent boundaries.
- Email and SMS provider selection is an implementation concern established by prior planning; user-facing requirements are defined by channel availability, consent, preferences, auditability, and delivery outcomes.
- The active upload policy may be configured during planning, but organizers must see it before choosing a file and enforcement must be consistent.
- Reporting preview is informational in this phase. Full reporting, post-hack outputs, public recaps, exports, sponsor reports, and chapter history remain phase 5 scope under issue #146.
- Sponsor access remains out of scope until its access model is explicitly decided.
- This feature is a cutover to the event workspace as the organizer entry point; no legacy organizer workspace is maintained for backward compatibility.
