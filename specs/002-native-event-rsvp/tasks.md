# Tasks: Native Event Pages and RSVP

**Input**: Design documents from `/specs/002-native-event-rsvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because FR-044 explicitly requires validation coverage for public event visibility, approved-only details, chapter-admin publishing, MC/co-MC review permissions, user cancellation, pending-answer edits, answer locks after decision, waitlist auto-promotion behavior, manual application closure, default approval-required mode, ban filtering, and application composition order.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment after shared foundation work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks in the same phase
- **[Story]**: User story label from `spec.md`
- Every task includes the exact file path to change or create

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish cutover guardrails, shared fixtures, and concrete entry points before changing behavior.

- [X] T001 Audit Phase 1 placeholder enum/state usage and existing RSVP-related routes in `prisma/schema.prisma`, `src/app/api/events/`, `src/lib/`, and `tests/`
- [X] T002 [P] Create Phase 2 API and UI type definitions for public event cards, event detail state, registration forms, review rows, and application controls in `src/types/event-management.ts`
- [X] T003 [P] Extend event-management test fixtures with published/unpublished events, public/private chapters, signed-in applicants, banned applicants, MCs, co-MCs, waitlisted registrations, and approved-only details in `tests/utils/event-management-fixtures.ts`
- [X] T004 [P] Extend authenticated route test helpers with current-user registration helpers and site-admin include-banned request helpers in `tests/utils/api-auth.ts`
- [X] T005 [P] Create reusable date/time and calendar payload test fixtures for chapter timezone assertions in `tests/utils/event-rsvp-fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema, migrations, route helpers, and service logic that block public RSVP, organizer review, chapter pages, and capacity behavior.

**Critical**: No user story work should begin until this phase is complete.

- [X] T006 Replace `EventApplicationMode` values with `REQUIRES_APPROVAL` and `OPEN_RSVP`, default events to `REQUIRES_APPROVAL`, and replace `EventRegistrationSource.PUBLIC_LATER` with `WEBSITE` in `prisma/schema.prisma`
- [X] T007 Replace ambiguous event application state with `applicationsOpen Boolean @default(true)`, `applicationsClosedAt DateTime?`, `applicationsClosedById String?`, and `applicationsCloseReason String?` in `prisma/schema.prisma`
- [X] T008 Add registration submission and cancellation tracking fields `submittedAt`, `cancelledAt`, `cancelledById`, and optional waitlist ordering metadata in `prisma/schema.prisma`
- [X] T009 Create the Phase 2 Prisma cutover migration for enum values, application open/closed fields, registration timestamp fields, defaults, backfills, and indexes in `prisma/migrations/20260622000000_native_event_rsvp/migration.sql`
- [X] T010 Update seed data to use `REQUIRES_APPROVAL`, `WEBSITE`, explicit application open state, public chapter metadata, and representative published RSVP events in `prisma/seed.ts`
- [X] T011 [P] Implement public event query helpers for listing, slug detail lookup, viewer registration state, redaction, and add-to-calendar payload generation in `src/lib/publicEvents.ts`
- [X] T012 [P] Implement public registration helpers for submission validation, duplicate detection, ban blocking, pending edits, cancellation, and audit writes in `src/lib/eventRegistrations.ts`
- [X] T013 [P] Implement waitlist capacity helpers for approved counts, oldest waitlisted selection, manual promotion eligibility, and transactional auto-promotion in `src/lib/eventRegistrations.ts`
- [X] T014 [P] Implement application control helpers for open/closed state, required-field validation against snapshots, profile prefill mapping, and public-safe status messages in `src/lib/applicationTemplates.ts`
- [X] T015 [P] Extend shared permission helpers for public read redaction, chapter-admin publish scope, MC decision permission, co-MC note-only permission, and site-admin banned-user review context in `src/lib/eventManagementAuth.ts`
- [X] T016 Update event creation/update API parsing to accept only Phase 2 application mode and application open/closed semantics in `src/app/api/events/route.ts` and `src/app/api/events/[eventId]/route.ts`
- [X] T017 [P] Add helper tests for application schema merge order, required validation, profile prefill, and snapshot preservation in `tests/lib/applicationTemplates.test.ts`
- [X] T018 [P] Add helper tests for redaction, public event filters, viewer registration state, and calendar payload fields in `tests/lib/publicEvents.test.ts`
- [X] T019 [P] Add helper tests for capacity counts, waitlist ordering, auto-promotion transaction behavior, cancellation audit entries, and submitted timestamp preservation in `tests/lib/eventRegistrations.test.ts`
- [X] T020 [P] Add permission matrix tests for chapter-admin publishing, MC decisions, co-MC decision denial, co-MC notes, and site-admin banned review context in `tests/lib/eventManagementAuth.test.ts`

**Checkpoint**: Foundation ready; user story implementation can now begin in parallel where capacity allows.

---

## Phase 3: User Story 1 - Hackers Discover Published Events (Priority: P1) - MVP

**Goal**: A visitor or signed-in hacker can browse native Sundai event listings, filter by chapter, and open published event details without exposing unpublished events or approved-only details.

**Independent Test**: Publish events across multiple chapters, browse `/events`, filter by chapter, open `/events/[chapterSlug]/[eventSlug]`, and confirm unpublished events and sensitive details are hidden from anonymous and pending users.

### Tests for User Story 1

- [X] T021 [P] [US1] Add API tests for `GET /api/events` public listing, chapter filtering, unpublished exclusion, public-only fields, and signed-in viewer registration state in `tests/api/public-events.test.ts`
- [X] T022 [P] [US1] Add API tests for event detail redaction by id for anonymous, pending, approved, and organizer viewers in `tests/api/public-events.test.ts`
- [X] T023 [P] [US1] Add page tests for native `/events` listing cards, chapter filter controls, event links, empty state, and removal of the Google Calendar embed in `tests/pages/EventsPage.test.tsx`
- [X] T024 [P] [US1] Add page tests for `/events/[chapterSlug]/[eventSlug]` public fields, approved-only redaction, current user status, and add-to-calendar action in `tests/pages/EventDetailPage.test.tsx`

### Implementation for User Story 1

- [X] T025 [US1] Cut over `GET /api/events` public behavior to return only upcoming published public events with optional `chapterSlug` filtering and viewer registration state in `src/app/api/events/route.ts`
- [X] T026 [US1] Redact approved-only details from public event id reads unless the viewer is approved or an authorized organizer in `src/app/api/events/[eventId]/route.ts`
- [X] T027 [US1] Replace the calendar embed with native event listing UI, chapter filter controls, status badges, and links to event detail pages in `src/app/events/page.tsx`
- [X] T028 [US1] Create the public event detail route with slug lookup, public fields, viewer status, approved-only redaction, and add-to-calendar payload in `src/app/events/[chapterSlug]/[eventSlug]/page.tsx`
- [X] T029 [P] [US1] Create reusable event card and status display components for public listings in `src/app/components/PublicEventCard.tsx`
- [X] T030 [P] [US1] Create reusable approved-only details and add-to-calendar components in `src/app/components/EventDetailSections.tsx`

**Checkpoint**: User Story 1 is independently functional as the public discovery MVP.

---

## Phase 4: User Story 2 - Hackers Apply, Track Status, And Cancel (Priority: P1)

**Goal**: A signed-in hacker can submit an application, see status, edit answers while pending, and cancel their own registration.

**Independent Test**: Sign in as a hacker, submit an application for a published approval-required event, confirm pending state, edit answers while pending, cancel, and confirm approved/declined users cannot edit answers.

### Tests for User Story 2

- [X] T031 [P] [US2] Add API tests for public application submission, no guest submissions, duplicate registration handling, `PENDING` default, `WEBSITE` source, template snapshot storage, and generic blocked-user response in `tests/api/public-event-registrations.test.ts`
- [X] T032 [P] [US2] Add API tests for pending answer edits preserving `submittedAt` and denying edits for approved, waitlisted, declined, blocked, and cancelled registrations in `tests/api/public-event-registrations.test.ts`
- [X] T033 [P] [US2] Add API tests for current-user cancellation, cancelled audit entries, cancellation fields, and active-state removal from public detail responses in `tests/api/public-event-registrations.test.ts`
- [X] T034 [P] [US2] Add page tests for application form rendering, profile prefill, required-field errors, pending edit mode, locked decided states, cancellation controls, and public-safe status messages in `tests/pages/EventDetailPage.test.tsx`

### Implementation for User Story 2

- [X] T035 [US2] Implement signed-in public registration submission with composed snapshot validation, ban blocking, duplicate handling, pending default, and audit write in `src/app/api/events/[eventId]/registrations/route.ts`
- [X] T036 [US2] Create pending answer edit endpoint for the current user in `src/app/api/events/[eventId]/registrations/me/route.ts`
- [X] T037 [US2] Create current-user registration cancellation endpoint with audit write and cancellation fields in `src/app/api/events/[eventId]/registrations/me/cancel/route.ts`
- [X] T038 [P] [US2] Create the reusable public application form with profile prefill, required-field validation display, pending edit state, and locked-state rendering in `src/app/components/EventApplicationForm.tsx`
- [X] T039 [US2] Wire the application form, current registration status, edit action, cancel action, and public-safe messages into the event detail page in `src/app/events/[chapterSlug]/[eventSlug]/page.tsx`
- [X] T040 [US2] Ensure public registration responses never expose internal notes, moderation state, ban reasons, waitlist rank, or decision reasons in `src/lib/eventRegistrations.ts`

**Checkpoint**: User Story 2 supports the full hacker application/status/cancellation loop without organizer review.

---

## Phase 5: User Story 3 - Organizers Create And Publish Chapter Events (Priority: P1)

**Goal**: Chapter admins can create, configure, and immediately publish events for their own chapter while site admins can create and publish for any chapter.

**Independent Test**: Sign in as a chapter admin, create an event for that chapter, configure public and approved-only details, publish it, and verify site admins can publish anywhere while MCs and co-MCs are denied.

### Tests for User Story 3

- [X] T041 [P] [US3] Add API tests for chapter-admin and site-admin event creation fields, default approval-required mode, default disabled auto-promotion, public message text, and unauthorized MC/co-MC denial in `tests/api/organizer-events.test.ts`
- [X] T042 [P] [US3] Add API tests for immediate publishing by chapter admins and site admins, cross-chapter denial, and published-event visibility on public listing responses in `tests/api/organizer-events.test.ts`
- [X] T043 [P] [US3] Add page tests for `/organizer/events/new` required fields, timezone default, approved-only details, MC/co-MC assignment controls, application questions, message text fields, and publish action visibility in `tests/pages/OrganizerEventNew.test.tsx`
- [X] T044 [P] [US3] Add page tests for `/organizer/events/[eventId]/settings` application mode, waitlist toggle, open/closed state display, public versus approved-only details, and authorized edit behavior in `tests/pages/OrganizerEventSettings.test.tsx`

### Implementation for User Story 3

- [X] T045 [US3] Update event creation to default `applicationMode` to `REQUIRES_APPROVAL`, default `autoPromoteWaitlist` to false, validate event questions, store public message text, and deny MC/co-MC creation by staff role alone in `src/app/api/events/route.ts`
- [X] T046 [US3] Update event update behavior for Phase 2 event fields, approved-only details, staff assignments, public messages, and chapter/site-admin scoping in `src/app/api/events/[eventId]/route.ts`
- [X] T047 [US3] Restrict event publishing to site admins and chapter admins in scope, and ensure published events become visible to public discovery immediately in `src/app/api/events/[eventId]/publish/route.ts`
- [X] T048 [US3] Update organizer event creation UI with chapter selection, slug, public location, approved-only details, capacity, approval-required default, auto-promote toggle default off, staff assignment, application questions, and public status message fields in `src/app/organizer/events/new/page.tsx`
- [X] T049 [US3] Update organizer event settings UI with Phase 2 event metadata, public/private detail separation, application mode controls, message fields, staff assignment, and publish-state controls in `src/app/organizer/events/[eventId]/settings/page.tsx`
- [X] T050 [P] [US3] Update organizer event index to show chapter, public status, application state, capacity, and links to settings and registrations in `src/app/organizer/events/page.tsx`

**Checkpoint**: User Story 3 lets authorized organizers create and publish native RSVP-ready events.

---

## Phase 6: User Story 4 - Organizers Review Applications Safely (Priority: P1)

**Goal**: Authorized organizers can review registrations by status, add internal context, make decisions according to role, and avoid leaking banned applicant signals to non-site-admins.

**Independent Test**: Use pending, approved, waitlisted, declined, cancelled, and globally banned applicants with an MC, co-MC, chapter admin, and site admin to confirm each role sees and can act only within its boundary.

### Tests for User Story 4

- [X] T051 [P] [US4] Add API tests for registration review status filters, normal non-site-admin ban filtering, and site-admin `includeBannedUsers=true` behavior in `tests/api/event-registration-review.test.ts`
- [X] T052 [P] [US4] Add API tests for MC approve/waitlist/decline, co-MC decision denial, chapter-admin/site-admin decision permission, public decline message use, and audit entries in `tests/api/event-registration-review.test.ts`
- [X] T053 [P] [US4] Add API tests for event-specific internal note updates by MC/co-MC/chapter-admin/site-admin and public-response exclusion of notes in `tests/api/event-registration-review.test.ts`
- [X] T054 [P] [US4] Add page tests for registration queue tabs, applicant answer display, internal note editing, role-specific decision controls, hidden banned applicants, and site-admin banned context in `tests/pages/OrganizerEventRegistrations.test.tsx`

### Implementation for User Story 4

- [X] T055 [US4] Update organizer registration listing with status filters, applicant summaries, answers, organizer note context, non-site-admin ban filtering, and site-admin banned context in `src/app/api/events/[eventId]/registrations/route.ts`
- [X] T056 [US4] Update organizer registration status decisions with MC/chapter-admin/site-admin permission, co-MC denial, public message fields, and audit entries in `src/app/api/events/[eventId]/registrations/[registrationId]/route.ts`
- [X] T057 [US4] Create registration internal note endpoint with MC, co-MC, chapter-admin, and site-admin access plus audit entries in `src/app/api/events/[eventId]/registrations/[registrationId]/notes/route.ts`
- [X] T058 [US4] Create organizer cancellation/admin-removal endpoint with decision permission, cancellation audit fields, and shared waitlist promotion trigger in `src/app/api/events/[eventId]/registrations/[registrationId]/cancel/route.ts`
- [X] T059 [US4] Create organizer registration review page with status tabs, applicant answer review, internal notes, role-specific decision buttons, and site-admin-only banned context in `src/app/organizer/events/[eventId]/registrations/page.tsx`
- [X] T060 [P] [US4] Create reusable registration review row and action components with note-only co-MC state in `src/app/components/RegistrationReviewQueue.tsx`

**Checkpoint**: User Story 4 supports safe organizer review without public or non-site-admin moderation leaks.

---

## Phase 7: User Story 5 - Hackers See Chapter Pages (Priority: P2)

**Goal**: Visitors and hackers can browse active chapters and chapter pages with upcoming published events, without bespoke chapter marketing pages.

**Independent Test**: Create active chapters with published upcoming events, browse `/chapters`, open `/chapters/[chapterSlug]`, and confirm chapter information, next events, upcoming events, mailing-list CTA, and private chapter visibility rules.

### Tests for User Story 5

- [X] T061 [P] [US5] Add API tests for public chapter directory active filtering, next published event summaries, private chapter visibility, and no unpublished event leakage in `tests/api/chapter-visibility.test.ts`
- [X] T062 [P] [US5] Add API tests for chapter detail by slug with upcoming published events, public chapter metadata, mailing-list CTA data, and private chapter access rules in `tests/api/chapters.test.ts`
- [X] T063 [P] [US5] Add page tests for `/chapters` active chapter cards, city/timezone display, next event links, and empty states in `tests/pages/ChaptersPage.test.tsx`
- [X] T064 [P] [US5] Add page tests for `/chapters/[chapterSlug]` public description, upcoming event links, mailing-list CTA, and no custom homepage-builder controls in `tests/pages/ChapterPage.test.tsx`

### Implementation for User Story 5

- [X] T065 [US5] Update chapter listing API to include active public chapters, signed-in private chapter visibility, and next published event summaries in `src/app/api/chapters/route.ts`
- [X] T066 [US5] Update chapter detail API to resolve by slug, include upcoming published events, expose mailing-list CTA metadata, and preserve Phase 1 membership visibility in `src/app/api/chapters/[chapterId]/route.ts`
- [X] T067 [US5] Update chapter directory UI with active chapter cards, city, timezone, next event, and links to chapter pages in `src/app/chapters/page.tsx`
- [X] T068 [US5] Update chapter page UI with public chapter description, upcoming published event list, event links, and provider-neutral mailing-list CTA in `src/app/chapters/[chapterSlug]/page.tsx`

**Checkpoint**: User Story 5 gives every active chapter a consistent Sundai-owned discovery page.

---

## Phase 8: User Story 6 - Organizers Manage Capacity, Closures, And Waitlist Movement (Priority: P2)

**Goal**: Organizers can close/reopen applications, manage capacity, use waitlists, and optionally enable automatic waitlist promotion.

**Independent Test**: Set capacity, close and reopen applications, waitlist applicants, cancel an approved registration with auto-promotion disabled and enabled, and verify only the enabled case promotes the oldest waitlisted user.

### Tests for User Story 6

- [X] T069 [P] [US6] Add API tests for manual application close/open permission, closed metadata, public-safe closed submission response, and existing registration review continuity in `tests/api/event-application-controls.test.ts`
- [X] T070 [P] [US6] Add API tests for waitlist auto-promotion default off, no promotion when disabled, oldest eligible promotion when enabled, capacity-safe behavior, and audit records in `tests/api/event-application-controls.test.ts`
- [X] T071 [P] [US6] Add page tests for organizer settings close/reopen controls, close reason display, capacity display, and auto-promote waitlist toggle in `tests/pages/OrganizerEventSettings.test.tsx`
- [X] T072 [P] [US6] Add page tests for public event detail closed-applications state, waitlisted state without rank, and approved-only detail reveal after automatic promotion in `tests/pages/EventDetailPage.test.tsx`

### Implementation for User Story 6

- [X] T073 [US6] Create manual application close endpoint with organizer permission, closed metadata, reason storage, and audit/change record in `src/app/api/events/[eventId]/applications/close/route.ts`
- [X] T074 [US6] Create manual application reopen endpoint with organizer permission, closed metadata clearing, and audit/change record in `src/app/api/events/[eventId]/applications/open/route.ts`
- [X] T075 [US6] Block new public submissions when applications are closed while preserving existing registration status, edit, cancellation, and organizer review behavior in `src/app/api/events/[eventId]/registrations/route.ts`
- [X] T076 [US6] Trigger transactional waitlist auto-promotion from current-user cancellation and organizer cancellation when an approved registration frees capacity in `src/app/api/events/[eventId]/registrations/me/cancel/route.ts` and `src/app/api/events/[eventId]/registrations/[registrationId]/cancel/route.ts`
- [X] T077 [US6] Add organizer settings controls for close/reopen, close reason, capacity, current approved count, and auto-promote waitlist toggle in `src/app/organizer/events/[eventId]/settings/page.tsx`
- [X] T078 [US6] Update public event detail status rendering for closed applications, waitlisted-without-rank, cancelled, declined, blocked, and post-promotion approved states in `src/app/events/[chapterSlug]/[eventSlug]/page.tsx`

**Checkpoint**: User Story 6 provides explicit capacity and application-flow controls without automatic promotion unless enabled.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validate cutover completeness, acceptance coverage, performance, and out-of-scope boundaries.

- [X] T079 [P] Remove stale `NONE`, `INTERNAL`, `PUBLIC_LATER`, nullable `applicationsOpen DateTime`, Google Calendar primary discovery, guest RSVP, check-in QR, attendance migration, historical import, public waitlist rank, and custom chapter homepage references from `src/`, `tests/`, and `prisma/schema.prisma`
- [X] T080 [P] Add indexed-query or regression coverage for public event listing, chapter page next events, registration review status filters, ban filtering, and waitlist promotion lookups in `tests/lib/publicEvents.test.ts`, `tests/lib/chapters.test.ts`, and `tests/lib/eventRegistrations.test.ts`
- [X] T081 [P] Update manual acceptance checklist and focused test commands after implementation in `specs/002-native-event-rsvp/quickstart.md`
- [X] T082 Run focused public event and application tests with `npm run test -- tests/api/public-events.test.ts tests/api/public-event-registrations.test.ts tests/pages/EventsPage.test.tsx tests/pages/EventDetailPage.test.tsx --runInBand`
- [X] T083 Run focused organizer review and controls tests with `npm run test -- tests/api/event-registration-review.test.ts tests/api/event-application-controls.test.ts tests/pages/OrganizerEventRegistrations.test.tsx tests/pages/OrganizerEventSettings.test.tsx --runInBand`
- [X] T084 Run focused chapter page tests with `npm run test -- tests/api/chapter-visibility.test.ts tests/api/chapters.test.ts tests/pages/ChaptersPage.test.tsx tests/pages/ChapterPage.test.tsx --runInBand`
- [X] T085 Run the full Jest suite with `npm run test`
- [X] T086 Run the production build with `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user story phases.
- **P1 Stories**: US1, US2, US3, and US4 depend on Phase 2 and may be implemented in priority order or in parallel by separate developers after shared helpers exist.
- **P2 Stories**: US5 and US6 depend on Phase 2; US5 can proceed independently after public event helpers exist, and US6 depends on cancellation/review behavior from US2 and US4 for full validation.
- **Polish**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: First MVP slice after foundation; no story dependency.
- **US2 (P1)**: Depends on US1 event detail surface for complete UI integration, but public registration APIs can be built after foundation.
- **US3 (P1)**: Depends on foundation permissions and event schema defaults; independent from public application submission.
- **US4 (P1)**: Depends on foundation permissions and registration helpers; review UI is most useful after US2 creates public registrations.
- **US5 (P2)**: Depends on public event query helpers; independent from RSVP submission and organizer review.
- **US6 (P2)**: Depends on registration cancellation and organizer review endpoints for full close/reopen and promotion acceptance.

### Within Each User Story

- Write the story tests first and confirm they fail.
- Implement shared helper behavior before route handlers that consume it.
- Implement route handlers before UI surfaces that call them.
- Keep public redaction, permission checks, and ban filtering server-side.
- Validate each story independently before moving to lower-priority stories.

---

## Parallel Opportunities

- Setup tasks T002-T005 can run in parallel after T001 identifies current usage.
- Foundational helper tasks T011-T015 and tests T017-T020 can run in parallel after schema task ownership is clear.
- US1 tests T021-T024 can run in parallel; UI components T029-T030 can run in parallel with route tasks T025-T026 after the response shape is fixed.
- US2 tests T031-T034 can run in parallel; component task T038 can run in parallel with endpoint tasks T035-T037 after form contracts are fixed.
- US3 tests T041-T044 can run in parallel; organizer index task T050 can run in parallel with creation/settings UI tasks after route contracts are fixed.
- US4 tests T051-T054 can run in parallel; reusable queue component T060 can run in parallel with API endpoint tasks after review row shape is fixed.
- US5 tests T061-T064 can run in parallel; directory and chapter page tasks T067-T068 can run in parallel after API response shapes are fixed.
- US6 tests T069-T072 can run in parallel; settings UI task T077 can run in parallel with close/open route tasks after application-control contract is fixed.

---

## Parallel Example: User Story 1

```bash
# API and page tests can be written together:
Task: "T021 [P] [US1] Add API tests for GET /api/events public listing in tests/api/public-events.test.ts"
Task: "T023 [P] [US1] Add page tests for native /events listing in tests/pages/EventsPage.test.tsx"

# UI components can be built while route behavior is implemented:
Task: "T025 [US1] Cut over GET /api/events public behavior in src/app/api/events/route.ts"
Task: "T029 [P] [US1] Create reusable event card and status display components in src/app/components/PublicEventCard.tsx"
```

## Parallel Example: User Story 2

```bash
# Endpoints split by file can be worked in sequence or by separate owners:
Task: "T036 [US2] Create pending answer edit endpoint in src/app/api/events/[eventId]/registrations/me/route.ts"
Task: "T037 [US2] Create current-user registration cancellation endpoint in src/app/api/events/[eventId]/registrations/me/cancel/route.ts"

# Form work can proceed once the answer schema is known:
Task: "T038 [P] [US2] Create the reusable public application form in src/app/components/EventApplicationForm.tsx"
```

## Parallel Example: User Story 4

```bash
# Review behavior has separate API, UI, and component work:
Task: "T055 [US4] Update organizer registration listing in src/app/api/events/[eventId]/registrations/route.ts"
Task: "T059 [US4] Create organizer registration review page in src/app/organizer/events/[eventId]/registrations/page.tsx"
Task: "T060 [P] [US4] Create reusable registration review row and action components in src/app/components/RegistrationReviewQueue.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup and Phase 2 foundation.
2. Complete US1 so native event discovery and detail pages replace the external calendar-centered surface.
3. Validate US1 independently with `tests/api/public-events.test.ts`, `tests/pages/EventsPage.test.tsx`, and `tests/pages/EventDetailPage.test.tsx`.

### P1 Native RSVP Cutover

1. Add US2 public application, status, edit, and cancellation.
2. Add US3 event creation and publishing defaults so chapter admins can make events live.
3. Add US4 organizer review with role-specific decisions and ban filtering.
4. Validate the full P1 RSVP loop before adding P2 scope.

### P2 Expansion

1. Add US5 chapter directory/page updates for multi-chapter discovery.
2. Add US6 manual application closure, capacity controls, and optional waitlist auto-promotion.
3. Run focused tests, full Jest suite, and production build before handoff.

### Cutover Notes

- Do not keep compatibility branches for `NONE`, `INTERNAL`, `PUBLIC_LATER`, or nullable timestamp-style `applicationsOpen`.
- Do not expose guest RSVP, check-in QR/scanner, attendance migration, historical Partiful import, public waitlist rank, custom chapter landing-page builder, notification provider settings UI, or pitch queue replacement.
- Keep `/pitch` and `/pitch/[eventId]` alive and link from native event pages only where relevant.

## Approval And Decline Notifications

- [X] T093 Send approval and decline emails through AWS SES according to active chapter-membership notification preferences.
- [X] T094 Send approval and decline SMS messages through Twilio according to active chapter-membership notification preferences.
- [X] T095 Keep registration decisions authoritative when a notification provider fails and add focused preference, content, and failure tests.
