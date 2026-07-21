# Tasks: Organizer Event Workspace

**Input**: Design documents from `specs/003-organizer-event-workspace/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: The feature specification explicitly requires permission, visibility, privacy, audience-snapshot, delivery-failure, and pitch-regression tests. Test tasks are written before their corresponding implementations and must initially fail for the intended missing behavior.

**Organization**: Tasks are grouped by user story so each increment can be implemented and acceptance-tested against its independent test criteria.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and does not depend on an incomplete task.
- **[Story]**: Maps a task to the corresponding user story from `spec.md`.
- Every task names the exact file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared configuration and types used by the organizer workspace.

- [X] T001 Add private material-storage and versioned SMS-consent configuration placeholders and comments to `.env.example`
- [X] T002 [P] Define workspace capabilities, overview projections, material contracts, communication contracts, and project-card states in `src/types/event-workspace.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the persistence, fixtures, and capability-specific authorization required by every user story.

**⚠️ CRITICAL**: Complete this phase before beginning user-story implementation.

- [X] T003 Add organizer-workspace enums, `EventMaterial`, `EventMaterialAudit`, `EventCommunication`, `EventCommunicationRecipient`, `EventStaffAudit`, `ChapterMembership.smsConsentAt/smsConsentVersion`, the `PitchProject.cardStatus` field, relations, indexes, and the one-role-per-event staff constraint to `prisma/schema.prisma`
- [X] T004 Create the cutover migration, including deterministic MC precedence for duplicate staff assignments and all new tables/indexes, in `prisma/migrations/20260710_organizer_event_workspace/migration.sql`
- [X] T005 [P] Extend Prisma mocks and builders for materials, communications, recipient snapshots, staff audits, consent evidence, and card status in `tests/utils/event-management-fixtures.ts`
- [X] T006 [P] Add failing capability-matrix tests for workspace access, event administration, operational management, communications, materials, notes, pitch, and applicant decisions in `tests/lib/eventManagementAuth.test.ts`
- [X] T007 Implement capability-specific context helpers and remove staff-role MC access from generic event administration in `src/lib/eventManagementAuth.ts`
- [X] T008 Add reusable current-scope route guards for workspace access, event administration, event operations, communications, materials, notes, and pitch in `src/lib/eventManagementApi.ts`
- [X] T009 Validate the new persistence model and generated client against `prisma/schema.prisma`

**Checkpoint**: Persistence and permission foundations are ready; User Story 1 can start, followed by the remaining story phases.

---

## Phase 3: User Story 1 - Organizers Run an Event From One Workspace (Priority: P1) 🎯 MVP

**Goal**: Provide the event-scoped organizer shell, overview, existing RSVP integration, navigation, and reporting preview without exposing unauthorized or deferred phase-3 data.

**Independent Test**: Assign each organizer role, open one event workspace, verify overview identity/settings/safe counts/navigation and effective capability controls, confirm an unrelated user receives no organizer data, and confirm check-in/attendance/no-show functionality is unavailable.

### Tests for User Story 1

- [X] T010 [P] [US1] Add failing API tests for workspace access, capability flags, ban-safe overview aggregates, empty states, and deferred metrics in `tests/api/organizer-event-workspace.test.ts`
- [X] T011 [P] [US1] Add failing page tests for the event shell, overview, navigation, permission-lost state, and absent check-in controls in `tests/pages/OrganizerEventWorkspace.test.tsx`
- [X] T012 [P] [US1] Add failing integration tests for opening existing registration review inside the workspace shell without changing co-MC decision boundaries in `tests/pages/OrganizerEventRegistrations.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Implement the event workspace loader, role-aware capability projection, ban-safe aggregate queries, public URL, and deferred-metric descriptors in `src/lib/eventWorkspace.ts`
- [X] T014 [US1] Implement `GET /api/events/[eventId]/workspace` with current-scope authorization and stable error responses in `src/app/api/events/[eventId]/workspace/route.ts`
- [X] T015 [P] [US1] Create accessible event workspace navigation, role/status presentation, loading, unavailable, and permission-lost components in `src/app/organizer/events/[eventId]/WorkspaceShell.tsx`
- [X] T016 [US1] Add the shared organizer event layout and event-scoped section navigation in `src/app/organizer/events/[eventId]/layout.tsx`
- [X] T017 [US1] Build the overview page with identity, schedule, capacity, application state, staff, safe counts, public-link, empty states, and capability-gated actions in `src/app/organizer/events/[eventId]/page.tsx`
- [X] T018 [US1] Update organizer event-list links to make the workspace the operational entry point while retaining explicit settings access in `src/app/organizer/events/page.tsx`
- [X] T019 [US1] Adapt the existing registration-review page to the workspace layout and capability projection in `src/app/organizer/events/[eventId]/registrations/page.tsx`
- [X] T020 [P] [US1] Implement completed-phase-only reporting aggregates and explicit attendance/check-in/no-show unavailability in `src/lib/eventReportingPreview.ts`
- [X] T021 [US1] Add the reporting-preview API route in `src/app/api/events/[eventId]/reporting-preview/route.ts`
- [X] T022 [US1] Build the reporting preview section without legacy `Week`/`Attendance` inference in `src/app/organizer/events/[eventId]/reporting/page.tsx`

**Checkpoint**: Authorized organizers can operate from one event context and reach existing capabilities; no phase-3 or unauthorized data appears.

---

## Phase 4: User Story 2 - Organizers Manage Event Materials (Priority: P1)

**Goal**: Let organizers create, classify, order, retrieve, update, and remove link/file resources while enforcing public, approved-attendee, and organizer-only access at listing and content retrieval.

**Independent Test**: Create links and files at all three visibility levels, verify the organizer/approved/pending/anonymous matrix at both list and download time, then edit/reorder/remove resources and reject invalid uploads without a material record.

### Tests for User Story 2

- [X] T023 [P] [US2] Add failing unit tests for the 25 MiB allowlist, link validation, visibility filtering, availability windows, finalization, and audit changes in `tests/lib/eventMaterials.test.ts`
- [X] T024 [P] [US2] Add failing route tests for upload intents, link/file creation, update, removal, and authorization-checked content redirects in `tests/api/event-materials.test.ts`
- [X] T025 [P] [US2] Add failing organizer UI tests for policy display, upload/link flows, visibility, ordering, empty/error states, and deletion in `tests/pages/OrganizerEventMaterials.test.tsx`
- [X] T026 [P] [US2] Add failing public event tests for public/approved material projection and organizer-only metadata redaction in `tests/pages/EventDetailPage.test.tsx`

### Implementation for User Story 2

- [X] T027 [P] [US2] Add private-object upload intent, metadata inspection, deletion, and short-lived signed download helpers without durable public URLs in `src/lib/gcp-storage.ts`
- [X] T028 [US2] Implement material validation, visibility/availability queries, upload finalization cleanup, ordering, deletion, and transactional audits in `src/lib/eventMaterials.ts`
- [X] T029 [US2] Implement the signed upload-intent endpoint in `src/app/api/events/[eventId]/materials/upload-intents/route.ts`
- [X] T030 [US2] Implement visibility-filtered listing and organizer link/file creation in `src/app/api/events/[eventId]/materials/route.ts`
- [X] T031 [US2] Implement organizer update/removal with audit preservation in `src/app/api/events/[eventId]/materials/[materialId]/route.ts`
- [X] T032 [US2] Implement current-viewer authorization and signed file redirect behavior in `src/app/api/events/[eventId]/materials/[materialId]/content/route.ts`
- [X] T033 [P] [US2] Build the material policy, editor, uploader, visibility labels, ordering, availability, and confirmation components in `src/app/organizer/events/[eventId]/materials/EventMaterialsPanel.tsx`
- [X] T034 [US2] Add the workspace Materials section with loading, empty, invalid-upload, provider-failure, and permission-lost states in `src/app/organizer/events/[eventId]/materials/page.tsx`
- [X] T035 [US2] Render only authorized, currently available material links/downloads on the native public event experience in `src/app/events/[chapterSlug]/[eventSlug]/page.tsx`

**Checkpoint**: Material metadata and underlying content enforce the full visibility matrix, and invalid uploads leave no active material record.

---

## Phase 5: User Story 3 - Organizers Communicate With Registration Audiences (Priority: P1)

**Goal**: Provide consent-aware email/SMS draft, preview, reconfirmation, send, immutable audience snapshot, and recipient-level outcome history.

**Independent Test**: Build audiences from every supported registration status, verify channel preference/contact/consent/ban exclusions, force a preview-to-send change and partial provider failure, then verify reconfirmation, immutable snapshots, and unchanged registrations.

### Tests for User Story 3

- [X] T036 [P] [US3] Add failing audience-resolution tests for statuses, selected users, cancellation, channel eligibility, versioned SMS consent, global-ban privacy, and deterministic fingerprints in `tests/lib/eventCommunications.test.ts`
- [X] T037 [P] [US3] Add failing provider-adapter tests for SES/Twilio availability, successful sends, sanitized failures, and independent recipient outcomes in `tests/lib/eventDelivery.test.ts`
- [X] T038 [P] [US3] Add failing API tests for draft immutability, preview counts, `409` reconfirmation, idempotent send state, snapshots, and partial failures in `tests/api/event-communications.test.ts`
- [X] T039 [P] [US3] Add failing UI tests for channel availability, audience composer, preview confirmation, changed-audience handling, and history details in `tests/pages/OrganizerEventCommunications.test.tsx`
- [X] T040 [P] [US3] Add failing membership API/page tests for recording and clearing versioned SMS consent with notification preferences in `tests/api/chapter-membership.test.ts` and `tests/pages/ChaptersPage.test.tsx`

### Implementation for User Story 3

- [X] T041 [US3] Extend notification preference types and update logic to record/clear `smsConsentAt` and configured consent version only on explicit opt-in in `src/types/event-management.ts` and `src/lib/chapters.ts`
- [X] T042 [US3] Enforce versioned SMS consent in the chapter notification endpoint in `src/app/api/chapters/[chapterId]/notifications/route.ts`
- [X] T043 [US3] Display configured consent copy and explicit SMS opt-in behavior on the chapter preference surface in `src/app/chapters/[chapterSlug]/page.tsx`
- [X] T044 [US3] Implement communication draft validation, provider availability, audience resolution, privacy-safe exclusions, fingerprints, atomic recipient snapshots, and aggregate final states in `src/lib/eventCommunications.ts`
- [X] T045 [P] [US3] Extract provider-neutral SES/Twilio send operations and sanitized delivery results while reusing existing configuration patterns in `src/lib/eventDelivery.ts`
- [X] T046 [US3] Implement paginated communication history and draft creation in `src/app/api/events/[eventId]/blasts/route.ts`
- [X] T047 [US3] Implement draft update, immutable sent-detail reads, and recipient-result pagination in `src/app/api/events/[eventId]/blasts/[blastId]/route.ts`
- [X] T048 [US3] Implement current-state audience preview and deterministic fingerprint responses in `src/app/api/events/[eventId]/blasts/[blastId]/preview/route.ts`
- [X] T049 [US3] Implement send-time audience recalculation, `409` reconfirmation, atomic snapshots, delivery, idempotent retry behavior, and result finalization in `src/app/api/events/[eventId]/blasts/[blastId]/send/route.ts`
- [X] T050 [P] [US3] Build the draft composer, channel/audience selectors, preview confirmation, aggregate exclusions, sending states, and immutable history detail components in `src/app/organizer/events/[eventId]/communications/EventCommunicationsPanel.tsx`
- [X] T051 [US3] Add the workspace Communications section with empty, unavailable-provider, retryable failure, partial-success, and permission-lost states in `src/app/organizer/events/[eventId]/communications/page.tsx`

**Checkpoint**: Enabled channels send only to eligible recipients, changed audiences require reconfirmation, and sent history remains immutable after later registration/preference changes.

---

## Phase 6: User Story 4 - Organizers Share Internal Hacker Notes Safely (Priority: P2)

**Goal**: Expose the one shared hacker notepad only through current event relevance, while restricting revision history to site/chapter admins and preventing serialization into public/attendee/message/reporting surfaces.

**Independent Test**: Read/update the same hacker note from relevant event contexts as every organizer role, deny unrelated-event access and MC/co-MC history, and scan all public/attendee/communication/reporting responses for note data.

### Tests for User Story 4

- [X] T052 [P] [US4] Add failing organizer-note domain tests for explicit event relevance, multi-context current-body consistency, ban filtering, and admin-only revisions in `tests/lib/organizerNotes.test.ts`
- [X] T053 [P] [US4] Add failing event-scoped route tests for note list/search, current note, update, revision denial, and removed-staff access in `tests/api/organizer-notes.test.ts`
- [X] T054 [P] [US4] Add failing workspace Notes UI tests for search, shared editing, warning copy, history visibility, and empty/error states in `tests/pages/OrganizerEventNotes.test.tsx`
- [X] T055 [P] [US4] Add failing cross-surface redaction assertions for notes/revisions in `tests/api/public-events.test.ts`, `tests/api/public-event-registrations.test.ts`, and `tests/api/event-communications.test.ts`

### Implementation for User Story 4

- [X] T056 [US4] Require explicit event scope for note relevance, list/search targets, current note updates, revisions, and ban-safe projections in `src/lib/organizerNotes.ts`
- [X] T057 [US4] Implement event-scoped note list/search in `src/app/api/events/[eventId]/notes/route.ts`
- [X] T058 [US4] Implement event-scoped current-note read/update in `src/app/api/events/[eventId]/notes/[hackerId]/route.ts`
- [X] T059 [US4] Implement admin-only event-scoped revision history in `src/app/api/events/[eventId]/notes/[hackerId]/revisions/route.ts`
- [X] T060 [US4] Cut over organizer note consumers and remove unscoped MC/co-MC access from `src/app/api/hackers/[hackerId]/organizer-note/route.ts`, `src/app/api/hackers/[hackerId]/organizer-note/revisions/route.ts`, and `src/app/components/OrganizerNotePanel.tsx`
- [X] T061 [US4] Build the event Notes search/list/editor/history surface with privacy guidance and capability-gated revision controls in `src/app/organizer/events/[eventId]/notes/page.tsx`

**Checkpoint**: Current notes are consistent across authorized event contexts, revisions are admin-only, and no attendee/public/message/report output leaks note data.

---

## Phase 7: User Story 5 - Organizers Coordinate Projects and Pitching (Priority: P2)

**Goal**: Show event-linked project/card/pitch state and launch the existing focused pitch controller for every organizer role without duplicating projects or adding pitch gates.

**Independent Test**: Attach one project to three event pitch sessions, update each card state independently, verify project/team/link/pitch projections, open controls as all organizer roles, and rerun hacker queue/voting behavior with incomplete cards.

### Tests for User Story 5

- [X] T062 [P] [US5] Add failing route tests for event project projections, per-event card-status updates, authorization, and multi-event identity in `tests/api/event-workspace-projects.test.ts`
- [X] T063 [P] [US5] Add failing Projects/Pitch workspace UI tests for project details, card states, queue/outcome data, and focused-controller links in `tests/pages/OrganizerEventProjects.test.tsx`
- [X] T064 [P] [US5] Extend pitch regression tests for site admin, chapter admin, MC, co-MC, hacker voting, and no card-status gate in `tests/api/events-transition.test.ts`, `tests/api/events-queue.test.ts`, and `tests/api/event-project-vote.test.ts`

### Implementation for User Story 5

- [X] T065 [US5] Implement event-linked `PitchProject` projections, event-specific card-status updates, and pitch summaries without a duplicate participation model in `src/lib/eventWorkspaceProjects.ts`
- [X] T066 [US5] Implement authorized event project listing in `src/app/api/events/[eventId]/projects/route.ts`
- [X] T067 [US5] Implement non-blocking card-status updates in `src/app/api/events/[eventId]/projects/[eventProjectId]/route.ts`
- [X] T068 [US5] Cut existing pitch controller routes over to the shared event-pitch capability guard in `src/app/api/events/[eventId]/pitch/`
- [X] T069 [P] [US5] Build the workspace Projects section with global project identity and event-specific card/queue/pitch state in `src/app/organizer/events/[eventId]/projects/page.tsx`
- [X] T070 [P] [US5] Build the workspace Pitch summary and `Open pitch controller` link to `/pitch/[eventId]` in `src/app/organizer/events/[eventId]/pitch/page.tsx`

**Checkpoint**: Projects remain global, event participation/card/pitch state remains independent, and existing pitch/voting behavior has no new card gate.

---

## Phase 8: User Story 6 - Administrators Control Event Staff and Lifecycle Actions (Priority: P2)

**Goal**: Give site/chapter admins audited staff and lifecycle controls in scope while preventing MC/co-MC operational assignments from gaining administrative authority.

**Independent Test**: Assign/change/remove MC/co-MC roles and attempt event settings/publish/unpublish/cancel actions as every role across in-scope and out-of-scope chapters, then verify immediate access revocation and audit actor/time.

### Tests for User Story 6

- [X] T071 [P] [US6] Add failing staff route tests for authorized reads, one-role assignment changes, transactional audits, removal, immediate revocation, and cross-chapter denial in `tests/api/event-staff.test.ts`
- [X] T072 [P] [US6] Add failing lifecycle/settings permission tests for admin success and MC/co-MC denial in `tests/api/events.test.ts` and `tests/api/organizer-events.test.ts`
- [X] T073 [P] [US6] Add failing workspace UI tests for admin-only staff/settings/lifecycle controls and audit history in `tests/pages/OrganizerEventAdministration.test.tsx`

### Implementation for User Story 6

- [X] T074 [US6] Make staff listing require workspace access and make assignment/role-change writes admin-only with same-transaction `EventStaffAudit` records in `src/app/api/events/[eventId]/staff/route.ts`
- [X] T075 [US6] Make staff removal admin-only with same-transaction audit and current-assignment revocation in `src/app/api/events/[eventId]/staff/[staffId]/route.ts`
- [X] T076 [US6] Apply admin-only event settings and lifecycle guards to event update, publish, application open/close, and organizer settings routes in `src/app/api/events/[eventId]/route.ts`, `src/app/api/events/[eventId]/publish/route.ts`, `src/app/api/events/[eventId]/applications/open/route.ts`, and `src/app/api/events/[eventId]/applications/close/route.ts`
- [X] T077 [US6] Build staff assignment/role/removal controls and admin-only audit history in `src/app/organizer/events/[eventId]/staff/EventStaffPanel.tsx`
- [X] T078 [US6] Integrate capability-gated staff, event settings, and lifecycle actions into `src/app/organizer/events/[eventId]/page.tsx` and `src/app/organizer/events/[eventId]/settings/page.tsx`

**Checkpoint**: Admin authority is chapter-scoped and audited; operational staff retain only their defined event capabilities and lose access immediately when removed.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Close security, accessibility, performance, documentation, and full-regression requirements across all delivered stories.

- [X] T079 [P] Add cross-story serialization tests preventing organizer notes, storage keys, contact snapshots, provider errors, internal review reasons, and moderation data from public/attendee responses in `tests/api/organizer-workspace-redaction.test.ts`
- [X] T080 [P] Add accessibility coverage for keyboard navigation, focus restoration, live status, visibility/status semantics, and destructive confirmations in `tests/pages/OrganizerEventWorkspaceAccessibility.test.tsx`
- [X] T081 Prevent organizer-only material references from becoming public communication attachments and add regression coverage in `src/lib/eventCommunications.ts` and `tests/lib/eventCommunications.test.ts`
- [X] T082 Review workspace aggregate/list queries for pagination, bounded includes, and indexed filters and document any query-shape adjustments in `src/lib/eventWorkspace.ts`, `src/lib/eventMaterials.ts`, `src/lib/eventCommunications.ts`, `src/lib/organizerNotes.ts`, and `src/lib/eventWorkspaceProjects.ts`
- [X] T083 [P] Document private material storage, provider availability, SMS consent versioning, and operational setup in `README.md`
- [X] T084 Run every focused verification command and record any necessary corrections in `specs/003-organizer-event-workspace/quickstart.md`
- [X] T085 Run the complete Jest suite and production build, resolving feature-related regressions in `tests/` and `src/`
- [X] T086 Add explicit event-project participation and migrate existing pitch-linked projects in `prisma/schema.prisma` and `prisma/migrations/20260720020000_event_project_participation/migration.sql`
- [X] T087 Attach newly created projects to currently running relevant chapter events in `src/app/api/projects/route.ts`
- [X] T088 Atomically attach pitch-session projects to their event in `src/app/api/events/[eventId]/pitch/queue/route.ts`
- [X] T089 Cut workspace project cards, counts, reporting, and note relevance over to `EventProject` in `src/lib/`
- [X] T090 Add focused creation, pitch attachment, standalone event-project, and workspace regressions in `tests/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational and establishes the shared workspace shell/navigation.
- **User Stories 2-6 (Phases 4-8)**: Depend on Foundational and the User Story 1 shell for final workspace integration; after User Story 1 they can proceed in parallel, subject to shared-file coordination.
- **Polish (Phase 9)**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Setup
  └── Foundational
        └── US1 Workspace MVP
              ├── US2 Materials
              ├── US3 Communications
              ├── US4 Notes
              ├── US5 Projects & Pitch
              └── US6 Staff & Lifecycle
                    └── Polish (after all selected stories)
```

US2-US6 have no functional dependency on one another. US3's organizer-material attachment hardening is deliberately deferred to cross-cutting task T081 so Materials and Communications can be developed independently.

### Within Each User Story

- Write the listed tests first and confirm the intended behavior fails.
- Implement domain/query helpers before route handlers.
- Implement route handlers before page integration.
- Re-run the story's focused tests at its checkpoint.
- Never use UI visibility as a substitute for server authorization.

### Shared-File Coordination

- `prisma/schema.prisma` and its migration are completed in Foundational before story work begins.
- US1 and US6 both touch the overview page; complete T017 before T078.
- US3 and Polish both touch `src/lib/eventCommunications.ts`; complete T044 before T081/T082.
- US4 and Polish both touch `src/lib/organizerNotes.ts`; complete T056 before T082.
- Pitch-route changes in T068 must precede the final pitch regression portion of T085.

## Parallel Opportunities

- T001 and T002 can run together.
- Foundational fixture work (T005) and authorization test authoring (T006) can run while schema work (T003-T004) is underway, then converge before validation.
- Within each story, all tasks explicitly marked `[P]` can run together at that point in the phase.
- After US1, US2-US6 may be assigned to separate implementers; their planned new domain/routes/pages are disjoint except for the shared-file coordination listed above.
- Cross-cutting redaction tests, accessibility tests, and README work (T079, T080, T083) can run together after story implementation.

## Parallel Execution Examples

### User Story 1

```text
Task T010: Write workspace API tests in tests/api/organizer-event-workspace.test.ts
Task T011: Write workspace page tests in tests/pages/OrganizerEventWorkspace.test.tsx
Task T012: Write registration-shell tests in tests/pages/OrganizerEventRegistrations.test.tsx
```

### User Story 2

```text
Task T023: Write material domain tests in tests/lib/eventMaterials.test.ts
Task T024: Write material API tests in tests/api/event-materials.test.ts
Task T025: Write material UI tests in tests/pages/OrganizerEventMaterials.test.tsx
Task T026: Write public material projection tests in tests/pages/EventDetailPage.test.tsx
```

### User Story 3

```text
Task T036: Write audience tests in tests/lib/eventCommunications.test.ts
Task T037: Write provider tests in tests/lib/eventDelivery.test.ts
Task T038: Write communication API tests in tests/api/event-communications.test.ts
Task T039: Write communication UI tests in tests/pages/OrganizerEventCommunications.test.tsx
Task T040: Write SMS consent tests in tests/api/chapter-membership.test.ts and tests/pages/ChaptersPage.test.tsx
```

### User Story 4

```text
Task T052: Write scoped note domain tests in tests/lib/organizerNotes.test.ts
Task T053: Write scoped note API tests in tests/api/organizer-notes.test.ts
Task T054: Write Notes UI tests in tests/pages/OrganizerEventNotes.test.tsx
Task T055: Write public/attendee/message redaction tests in existing API test files
```

### User Story 5

```text
Task T062: Write event-project API tests in tests/api/event-workspace-projects.test.ts
Task T063: Write Projects/Pitch UI tests in tests/pages/OrganizerEventProjects.test.tsx
Task T064: Extend existing pitch permission and no-card-gate regression tests
```

### User Story 6

```text
Task T071: Write staff authorization/audit tests in tests/api/event-staff.test.ts
Task T072: Write event lifecycle permission tests in existing event API suites
Task T073: Write administration UI tests in tests/pages/OrganizerEventAdministration.test.tsx
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundational.
2. Complete User Story 1 workspace shell, overview, registration integration, and reporting preview.
3. Run T010-T012 and verify the independent test criteria.
4. Demo the single event context before layering in new operational tools.

### Incremental Delivery

1. Deliver US1 as the workspace/navigation foundation.
2. Add US2 and US3 as the P1 operational replacement for scattered resources and external blasts.
3. Add US4-US6 as internal coordination, pitch integration, and administration increments.
4. Complete cross-cutting privacy/accessibility/performance checks and full validation.

### Parallel Team Strategy

After Setup, Foundational, and US1:

- Stream A: US2 Materials.
- Stream B: US3 Communications.
- Stream C: US4 Notes, then US6 Administration.
- Stream D: US5 Projects/Pitch.

Coordinate only the shared files listed in the dependency section, then converge for Phase 9.

## Notes

- All changes are cutovers; do not add legacy/fallback organizer paths.
- Keep `/pitch/[eventId]` as the maintained focused controller reached from the workspace.
- Never derive event attendance, checked-in, or no-show behavior from legacy `Week`/`Attendance` records.
- Non-site-admin rows, counts, audiences, notes, projects, and exports must filter globally blocked hackers before aggregation.
- Restricted material bytes remain private and require current authorization for every download.
- Message send confirmation always recalculates recipients and freezes an immutable snapshot.
- Commit after each task or coherent task group when requested.
