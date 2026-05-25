# Tasks: Event Management Foundations

**Input**: Design documents from `/specs/001-event-management-foundations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because FR-037 explicitly requires validation for permissions, visibility, membership, event staff, pitch continuity, application templates, global bans, organizer notes, and the site-admin role cutover.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment after shared foundation work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks in the same phase
- **[Story]**: User story label from `spec.md`
- Every task includes the exact file path to change or create

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish cutover guardrails and implementation entry points.

- [ ] T001 Audit current `Role.ADMIN`, `EventMC`, and pitch authorization usage in `src/`, `tests/`, `prisma/schema.prisma`, and `prisma/seed.ts`
- [ ] T002 [P] Create shared event-management type definitions in `src/types/event-management.ts`
- [ ] T003 [P] Create test fixture helpers for site admins, chapter admins, members, staff, bans, and organizer notes in `tests/utils/event-management-fixtures.ts`
- [ ] T004 [P] Create API route test utilities for authenticated Clerk requests in `tests/utils/api-auth.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, migrations, seed data, and authorization helpers that block all user story work.

**Critical**: No user story work should begin until this phase is complete.

- [ ] T005 Replace `ADMIN` with `SITE_ADMIN` in the `Role` enum and add chapter/event-management enums in `prisma/schema.prisma`
- [ ] T006 Add `Chapter`, `ChapterMembership`, `EventStaff`, `ApplicationTemplate`, `EventRegistration`, `EventRegistrationAudit`, `UserBan`, `UserBanFlag`, `HackerOrganizerNote`, and `HackerOrganizerNoteRevision` models in `prisma/schema.prisma`
- [ ] T007 Add event chapter, slug, visibility, application, capacity, location, approved-detail, and check-in metadata fields in `prisma/schema.prisma`
- [ ] T008 Create Prisma migration for site-admin cutover, new tables, event metadata, indexes, Boston chapter backfill, event slug cleanup markers, and `EventMC` to `EventStaff` migration in `prisma/migrations/20260525000000_event_management_foundations/migration.sql`
- [ ] T009 Update seed data to use `Role.SITE_ADMIN`, create the Boston chapter, create the active site application template, and seed `EventStaff` assignments in `prisma/seed.ts`
- [ ] T010 [P] Implement shared server-side permission helpers in `src/lib/eventManagementAuth.ts`
- [ ] T011 [P] Implement chapter visibility and membership helpers in `src/lib/chapters.ts`
- [ ] T012 [P] Implement application template composition and site-required-field validation in `src/lib/applicationTemplates.ts`
- [ ] T013 [P] Implement global-ban filtering and ban-flag helpers in `src/lib/moderation.ts`
- [ ] T014 [P] Implement organizer-note relevance, current-note, and revision helpers in `src/lib/organizerNotes.ts`
- [ ] T015 [P] Implement internal registration helpers and audit-record writing in `src/lib/eventRegistrations.ts`
- [ ] T016 Update middleware admin checks from `ADMIN` to `SITE_ADMIN` in `src/middleware.ts`
- [ ] T017 Update client user context admin derivation from `ADMIN` to `SITE_ADMIN` in `src/app/contexts/UserContext.tsx`
- [ ] T018 Update existing project moderation and project management authorization from `ADMIN` to `SITE_ADMIN` in `src/app/api/projects/[projectId]/approve/route.ts`, `src/app/api/projects/[projectId]/status/route.ts`, `src/app/api/projects/[projectId]/edit/route.ts`, `src/app/api/projects/[projectId]/route.ts`, `src/app/api/projects/[projectId]/submit/route.ts`, `src/app/api/projects/[projectId]/star/route.ts`, and `src/app/projects/[projectId]/ProjectDetailClient.tsx`
- [ ] T019 [P] Add permission matrix unit tests for site admins, chapter admins, members, MCs, co-MCs, regular users, and signed-out users in `tests/lib/eventManagementAuth.test.ts`
- [ ] T020 [P] Add application template composition unit tests for site-required fields and event overrides in `tests/lib/applicationTemplates.test.ts`
- [ ] T021 [P] Add migration-sensitive schema validation tests for Boston backfill, unique event slugs, and `EventStaff` migration assumptions in `tests/lib/eventManagementMigration.test.ts`
- [ ] T022 Update existing admin-context tests from `ADMIN` to `SITE_ADMIN` in `tests/contexts/UserContext.test.tsx` and `tests/middleware-comprehensive.test.ts`

**Checkpoint**: Foundation ready; user story implementation can now begin in parallel where capacity allows.

---

## Phase 3: User Story 1 - Site Admin Delegates Chapter Operations (Priority: P1) - MVP

**Goal**: A site admin can manage chapters, chapter admins, site application requirements, global bans, and global moderation without exposing those controls to non-site-admins.

**Independent Test**: Sign in as a site admin, create public and private chapters, assign and remove chapter admins, manage site-level application fields, create and revoke a global ban, then verify non-site-admin access is denied.

### Tests for User Story 1

- [ ] T023 [P] [US1] Add API tests for site-admin chapter CRUD and non-site-admin denial in `tests/api/chapters.test.ts`
- [ ] T024 [P] [US1] Add API tests for chapter admin assignment and only-admin removal rejection in `tests/api/chapter-admins.test.ts`
- [ ] T025 [P] [US1] Add API tests for site template creation, update, and required-field validation in `tests/api/application-templates.test.ts`
- [ ] T026 [P] [US1] Add API tests for global ban creation, revocation, and non-site-admin invisibility in `tests/api/admin-bans.test.ts`
- [ ] T027 [P] [US1] Add component tests for site-admin chapter and ban surfaces in `tests/pages/AdminEventManagement.test.tsx`

### Implementation for User Story 1

- [ ] T028 [US1] Implement `GET` and `POST` for site-admin chapter listing and creation in `src/app/api/chapters/route.ts`
- [ ] T029 [US1] Implement `GET` and `PATCH` for chapter details and settings in `src/app/api/chapters/[chapterId]/route.ts`
- [ ] T030 [US1] Implement chapter admin assignment in `src/app/api/chapters/[chapterId]/admins/route.ts`
- [ ] T031 [US1] Implement chapter admin removal with last-admin protection in `src/app/api/chapters/[chapterId]/admins/[hackerId]/route.ts`
- [ ] T032 [US1] Implement member-state listing for site-admin and chapter-admin management in `src/app/api/chapters/[chapterId]/members/route.ts`
- [ ] T033 [US1] Implement site and chapter application template list/create endpoints in `src/app/api/application-templates/route.ts`
- [ ] T034 [US1] Implement application template update validation in `src/app/api/application-templates/[templateId]/route.ts`
- [ ] T035 [US1] Implement merged application template preview endpoint in `src/app/api/application-templates/merged/route.ts`
- [ ] T036 [US1] Implement global ban listing and creation in `src/app/api/admin/bans/route.ts`
- [ ] T037 [US1] Implement global ban revocation in `src/app/api/admin/bans/[banId]/route.ts`
- [ ] T038 [US1] Implement site-admin ban-flag list and resolution endpoints in `src/app/api/admin/ban-flags/route.ts` and `src/app/api/admin/ban-flags/[flagId]/route.ts`
- [ ] T039 [US1] Replace the project-only admin page with a site-admin console in `src/app/admin/page.tsx`
- [ ] T040 [US1] Create the site-admin chapter management surface in `src/app/admin/chapters/page.tsx`
- [ ] T041 [US1] Create the site-admin application template surface in `src/app/admin/application-templates/page.tsx`
- [ ] T042 [US1] Create the site-admin global moderation surface in `src/app/admin/bans/page.tsx`
- [ ] T043 [US1] Move the existing project moderation surface to `src/app/admin/projects/page.tsx`

**Checkpoint**: User Story 1 is independently functional and testable as the MVP.

---

## Phase 4: User Story 2 - Chapter Admin Runs Local Chapter Operations (Priority: P1)

**Goal**: A chapter admin can manage only their chapter settings, members, invitations, local application questions, default declined-user messaging, chapter events, and ban flags.

**Independent Test**: Assign a user as chapter admin, update only their chapter, invite a hacker to a private chapter, manage members and local application questions, create an event, and verify cross-chapter actions are denied.

### Tests for User Story 2

- [ ] T044 [P] [US2] Add API tests for chapter-admin scoped settings, members, invitations, and cross-chapter denial in `tests/api/chapter-admin-operations.test.ts`
- [ ] T045 [P] [US2] Add API tests for chapter-level application templates and declined-message edits in `tests/api/chapter-application-templates.test.ts`
- [ ] T046 [P] [US2] Add API tests for chapter-admin event creation and unauthorized chapter denial in `tests/api/organizer-events.test.ts`
- [ ] T047 [P] [US2] Add API tests for chapter-admin ban flag creation without global-ban visibility in `tests/api/chapter-ban-flags.test.ts`
- [ ] T048 [P] [US2] Add component tests for the chapter settings organizer surface in `tests/pages/OrganizerChapterSettings.test.tsx`

### Implementation for User Story 2

- [ ] T049 [US2] Extend chapter settings updates with chapter-admin scoping and default declined-message fields in `src/app/api/chapters/[chapterId]/route.ts`
- [ ] T050 [US2] Implement private chapter invitation creation and reactivation in `src/app/api/chapters/[chapterId]/invites/route.ts`
- [ ] T051 [US2] Implement membership revocation and role/status updates in `src/app/api/chapters/[chapterId]/members/[membershipId]/route.ts`
- [ ] T052 [US2] Implement chapter-admin ban flag creation in `src/app/api/chapters/[chapterId]/ban-flags/route.ts`
- [ ] T053 [US2] Implement organizer event index with site-admin and chapter-admin filtering in `src/app/organizer/events/page.tsx`
- [ ] T054 [US2] Implement organizer event creation page for authorized chapters in `src/app/organizer/events/new/page.tsx`
- [ ] T055 [US2] Implement chapter-admin event creation behavior in `src/app/api/events/route.ts`
- [ ] T056 [US2] Implement chapter-specific application template editing on the organizer settings surface in `src/app/organizer/chapters/[chapterSlug]/settings/page.tsx`
- [ ] T057 [US2] Implement chapter members, invitations, admins, and ban flags sections in `src/app/organizer/chapters/[chapterSlug]/settings/page.tsx`

**Checkpoint**: User Story 2 works for one chapter without granting access to another chapter.

---

## Phase 5: User Story 3 - Hackers Join Chapters And Control Notification Permission (Priority: P1)

**Goal**: A signed-in hacker can discover public chapters, join multiple public chapters, accept private invitations, view membership state, and control per-chapter notification preferences.

**Independent Test**: Sign in as a hacker, join two public chapters, accept a private invite, update notification preferences per chapter, and confirm a non-invited user cannot see the private chapter.

### Tests for User Story 3

- [ ] T058 [P] [US3] Add API tests for public/private chapter visibility in `tests/api/chapter-visibility.test.ts`
- [ ] T059 [P] [US3] Add API tests for public chapter join, private invite acceptance, leave behavior, and notification preferences in `tests/api/chapter-membership.test.ts`
- [ ] T060 [P] [US3] Add component tests for chapter directory and landing pages in `tests/pages/ChaptersPage.test.tsx`

### Implementation for User Story 3

- [ ] T061 [US3] Implement visible chapter directory behavior in `src/app/api/chapters/route.ts`
- [ ] T062 [US3] Implement public chapter join behavior in `src/app/api/chapters/[chapterId]/join/route.ts`
- [ ] T063 [US3] Implement chapter leave behavior with only-admin protection in `src/app/api/chapters/[chapterId]/leave/route.ts`
- [ ] T064 [US3] Implement private chapter invite acceptance in `src/app/api/chapters/[chapterId]/invites/accept/route.ts`
- [ ] T065 [US3] Implement member notification preference updates in `src/app/api/chapters/[chapterId]/notifications/route.ts`
- [ ] T066 [US3] Create the chapter directory page in `src/app/chapters/page.tsx`
- [ ] T067 [US3] Create the chapter landing page with membership and invitation actions in `src/app/chapters/[chapterSlug]/page.tsx`

**Checkpoint**: User Story 3 is independently testable through chapter discovery and membership flows.

---

## Phase 6: User Story 4 - Event Staff Operates Assigned Events (Priority: P2)

**Goal**: Site admins and chapter admins can assign MCs and co-MCs; MCs and co-MCs can operate assigned event pitch workflows, while co-MCs cannot make applicant decisions.

**Independent Test**: Assign an MC and co-MC to an event, verify both can manage current pitch operations, verify MC metadata permissions, and verify co-MC applicant decision denial.

### Tests for User Story 4

- [ ] T068 [P] [US4] Update pitch transition, timer, advance, previous, and queue API tests for `EventStaff` MC and co-MC access in `tests/api/events-transition.test.ts`, `tests/api/events-pitch-timer.test.ts`, `tests/api/events-advance.test.ts`, `tests/api/events-queue.test.ts`, and `tests/api/events.test.ts`
- [ ] T069 [P] [US4] Add API tests for event staff assignment and removal in `tests/api/event-staff.test.ts`
- [ ] T070 [P] [US4] Add API tests denying co-MC applicant decisions in `tests/api/event-registrations.test.ts`

### Implementation for User Story 4

- [ ] T071 [US4] Replace `EventMC` includes and mutations with `EventStaff` in `src/app/api/events/route.ts` and `src/app/api/events/[eventId]/route.ts`
- [ ] T072 [US4] Implement event staff assignment and removal endpoints in `src/app/api/events/[eventId]/staff/route.ts` and `src/app/api/events/[eventId]/staff/[staffId]/route.ts`
- [ ] T073 [US4] Update pitch control authorization to use shared event staff helpers in `src/app/api/events/[eventId]/transition/route.ts`, `src/app/api/events/[eventId]/pitch-timer/route.ts`, `src/app/api/events/[eventId]/advance/route.ts`, `src/app/api/events/[eventId]/previous/route.ts`, `src/app/api/events/[eventId]/queue/route.ts`, `src/app/api/events/[eventId]/queue/[eventProjectId]/route.ts`, and `src/app/api/events/queue/[eventProjectId]/status/route.ts`
- [ ] T074 [US4] Update the pitch page staff data model from `mcs` to MC and co-MC staff assignments in `src/app/pitch/[eventId]/page.tsx`
- [ ] T075 [US4] Implement permission-specific event settings editing in `src/app/organizer/events/[eventId]/settings/page.tsx`

**Checkpoint**: User Story 4 preserves existing pitch behavior and adds co-MC operational access.

---

## Phase 7: User Story 5 - Organizers Use Internal Hacker Context Safely (Priority: P2)

**Goal**: Authorized organizers can view and edit relevant current organizer notes, while note revision history and global moderation details stay limited to higher-trust roles.

**Independent Test**: Create and edit an organizer note, verify site admins and relevant chapter admins can see revisions, verify assigned MCs and co-MCs can edit current notes only, and verify regular users cannot see notes.

### Tests for User Story 5

- [ ] T076 [P] [US5] Add organizer note API access tests for site admin, relevant chapter admin, assigned MC, assigned co-MC, regular user, and signed-out user in `tests/api/organizer-notes.test.ts`
- [ ] T077 [P] [US5] Add organizer note revision visibility tests in `tests/lib/organizerNotes.test.ts`
- [ ] T078 [P] [US5] Add component tests for organizer note editing surfaces in `tests/components/OrganizerNotePanel.test.tsx`

### Implementation for User Story 5

- [ ] T079 [US5] Implement current organizer note read and update endpoints in `src/app/api/hackers/[hackerId]/organizer-note/route.ts`
- [ ] T080 [US5] Implement organizer note revision history endpoint in `src/app/api/hackers/[hackerId]/organizer-note/revisions/route.ts`
- [ ] T081 [US5] Create the reusable organizer note panel in `src/app/components/OrganizerNotePanel.tsx`
- [ ] T082 [US5] Add organizer note panels to relevant organizer event and chapter workflows in `src/app/organizer/events/[eventId]/settings/page.tsx` and `src/app/organizer/chapters/[chapterSlug]/settings/page.tsx`

**Checkpoint**: User Story 5 supports current-note collaboration without leaking revision or ban data.

---

## Phase 8: User Story 6 - Event And Application Foundations Exist For Later RSVP Work (Priority: P3)

**Goal**: Organizers can manage richer event metadata, preview composed application requirements, and create internal registration records without exposing public RSVP/application/check-in pages.

**Independent Test**: Create an event for an authorized chapter, compose site-required, chapter-default, and event-specific questions, create internal registration records, and confirm no public RSVP flow appears.

### Tests for User Story 6

- [ ] T083 [P] [US6] Add API tests for rich event metadata creation, update, publish, and chapter scoping in `tests/api/event-management-foundations.test.ts`
- [ ] T084 [P] [US6] Add API tests for internal registration creation, status updates, audit records, ban filtering, and co-MC decision denial in `tests/api/event-registrations.test.ts`
- [ ] T085 [P] [US6] Add page tests confirming public `/events` exposes no native RSVP, application, approved-detail, RSVP status, or QR check-in flow in `tests/pages/EventsPage.test.tsx`

### Implementation for User Story 6

- [ ] T086 [US6] Extend event creation and update endpoints with chapter, slug, visibility, capacity, location, application, and approved-detail metadata in `src/app/api/events/route.ts` and `src/app/api/events/[eventId]/route.ts`
- [ ] T087 [US6] Implement event publishing in `src/app/api/events/[eventId]/publish/route.ts`
- [ ] T088 [US6] Implement internal registration listing and creation with non-site-admin ban filtering in `src/app/api/events/[eventId]/registrations/route.ts`
- [ ] T089 [US6] Implement internal registration status updates and audit records in `src/app/api/events/[eventId]/registrations/[registrationId]/route.ts`
- [ ] T090 [US6] Implement event-specific application question editing and merged preview in `src/app/organizer/events/[eventId]/settings/page.tsx`
- [ ] T091 [US6] Preserve existing public event listing behavior and prevent new RSVP/application/check-in actions in `src/app/events/page.tsx`

**Checkpoint**: User Story 6 provides later RSVP foundations without exposing public RSVP functionality.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validate cutover completeness, performance, and manual acceptance.

- [ ] T092 [P] Remove stale `EventMC` and `Role.ADMIN` references from tests and app code in `src/`, `tests/`, `prisma/schema.prisma`, and `prisma/seed.ts`
- [ ] T093 [P] Add indexed-query coverage or assertions for chapter visibility, staff lookup, registration filtering, and ban lookups in `tests/lib/eventManagementAuth.test.ts` and `tests/lib/chapters.test.ts`
- [ ] T094 [P] Update implementation notes and manual acceptance checklist in `specs/001-event-management-foundations/quickstart.md`
- [ ] T095 Run focused implementation checks with `npm run test -- tests/api/events.test.ts tests/api/events-queue.test.ts tests/contexts/UserContext.test.tsx tests/middleware-comprehensive.test.ts`
- [ ] T096 Run the full Jest suite with `npm run test`
- [ ] T097 Run the production build with `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user story phases.
- **P1 Stories**: US1, US2, and US3 depend on Phase 2 and may be implemented in priority order or in parallel by separate developers after shared helpers exist.
- **P2 Stories**: US4 and US5 depend on Phase 2; US4 benefits from US2 event creation surfaces but can be API-validated independently.
- **P3 Story**: US6 depends on Phase 2 and benefits from US1-US4 surfaces for full manual acceptance.
- **Polish**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: First MVP slice after foundation; no story dependency.
- **US2 (P1)**: Depends on chapter and membership foundation; integrates with US1 chapter APIs but remains scoped by chapter-admin permissions.
- **US3 (P1)**: Depends on chapter visibility and membership foundation; independent from admin UI completion.
- **US4 (P2)**: Depends on `EventStaff` foundation and event APIs; can validate pitch continuity without public RSVP work.
- **US5 (P2)**: Depends on organizer note and relevance helpers; can be validated from API and reusable component tests.
- **US6 (P3)**: Depends on event, template, registration, and ban foundations; must preserve public `/events` behavior.

### Within Each User Story

- Write the story tests first and confirm they fail.
- Implement helpers or route behavior before UI surfaces that consume them.
- Keep public visibility and permission checks server-side.
- Validate the story independently before moving to a lower-priority story.

---

## Parallel Opportunities

- Setup tasks T002-T004 can run in parallel.
- Foundational helper tasks T010-T015 and tests T019-T021 can run in parallel after schema direction is settled.
- US1 tests T023-T027 can run in parallel; UI pages T040-T042 can run in parallel after corresponding APIs exist.
- US2 tests T044-T048 can run in parallel; organizer pages T053-T057 can run in parallel after scoped APIs exist.
- US3 tests T058-T060 can run in parallel; pages T066-T067 can run in parallel after chapter APIs exist.
- US4 tests T068-T070 can run in parallel; pitch API updates T073 can be split by route file.
- US5 tests T076-T078 can run in parallel; note API and component work T079-T081 can run in parallel after `src/lib/organizerNotes.ts` exists.
- US6 tests T083-T085 can run in parallel; registration routes T088-T089 can run in parallel after `src/lib/eventRegistrations.ts` exists.

## Parallel Example: User Story 1

```bash
Task: "T023 [P] [US1] Add API tests for site-admin chapter CRUD and non-site-admin denial in tests/api/chapters.test.ts"
Task: "T025 [P] [US1] Add API tests for site template creation, update, and required-field validation in tests/api/application-templates.test.ts"
Task: "T026 [P] [US1] Add API tests for global ban creation, revocation, and non-site-admin invisibility in tests/api/admin-bans.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T044 [P] [US2] Add API tests for chapter-admin scoped settings, members, invitations, and cross-chapter denial in tests/api/chapter-admin-operations.test.ts"
Task: "T046 [P] [US2] Add API tests for chapter-admin event creation and unauthorized chapter denial in tests/api/organizer-events.test.ts"
Task: "T048 [P] [US2] Add component tests for the chapter settings organizer surface in tests/pages/OrganizerChapterSettings.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T058 [P] [US3] Add API tests for public/private chapter visibility in tests/api/chapter-visibility.test.ts"
Task: "T059 [P] [US3] Add API tests for public chapter join, private invite acceptance, leave behavior, and notification preferences in tests/api/chapter-membership.test.ts"
Task: "T060 [P] [US3] Add component tests for chapter directory and landing pages in tests/pages/ChaptersPage.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T068 [P] [US4] Update pitch transition, timer, advance, previous, and queue API tests for EventStaff MC and co-MC access in tests/api/events-transition.test.ts, tests/api/events-pitch-timer.test.ts, tests/api/events-advance.test.ts, tests/api/events-queue.test.ts, and tests/api/events.test.ts"
Task: "T069 [P] [US4] Add API tests for event staff assignment and removal in tests/api/event-staff.test.ts"
Task: "T070 [P] [US4] Add API tests denying co-MC applicant decisions in tests/api/event-registrations.test.ts"
```

## Parallel Example: User Story 5

```bash
Task: "T076 [P] [US5] Add organizer note API access tests for site admin, relevant chapter admin, assigned MC, assigned co-MC, regular user, and signed-out user in tests/api/organizer-notes.test.ts"
Task: "T077 [P] [US5] Add organizer note revision visibility tests in tests/lib/organizerNotes.test.ts"
Task: "T078 [P] [US5] Add component tests for organizer note editing surfaces in tests/components/OrganizerNotePanel.test.tsx"
```

## Parallel Example: User Story 6

```bash
Task: "T083 [P] [US6] Add API tests for rich event metadata creation, update, publish, and chapter scoping in tests/api/event-management-foundations.test.ts"
Task: "T084 [P] [US6] Add API tests for internal registration creation, status updates, audit records, ban filtering, and co-MC decision denial in tests/api/event-registrations.test.ts"
Task: "T085 [P] [US6] Add page tests confirming public /events exposes no native RSVP, application, approved-detail, RSVP status, or QR check-in flow in tests/pages/EventsPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation, including migration, seed, shared auth helpers, and core tests.
3. Complete Phase 3 US1.
4. Stop and validate US1 independently with site-admin chapter, template, and ban flows.

### Incremental Delivery

1. Foundation: schema, migration, seed data, shared helpers, and role cutover.
2. US1: site-admin global operations.
3. US2: chapter-admin local operations.
4. US3: hacker chapter discovery and membership.
5. US4: event staff and pitch continuity.
6. US5: organizer notes.
7. US6: event/application/registration foundations without public RSVP exposure.

### Validation Gate

Before handoff, complete T095-T097 and run the manual acceptance flow in `specs/001-event-management-foundations/quickstart.md`.

