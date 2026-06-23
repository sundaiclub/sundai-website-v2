# Implementation Plan: Native Event Pages and RSVP

**Branch**: `002-native-event-rsvp` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-native-event-rsvp/spec.md`

## Summary

Cut over event discovery and RSVP/application workflows from external calendar-centered behavior to native Sundai public event pages, chapter pages, signed-in event applications, user registration status controls, and organizer registration review. The implementation builds on Phase 1 event-management foundations from issue #142: chapters, `SITE_ADMIN`, chapter admins, `EventStaff`, application templates, internal registrations, global bans, organizer notes, and shared permission helpers are present locally. Phase 2 must finish the public-facing registration semantics, redaction rules, user-owned registration actions, organizer review actions, capacity/waitlist behavior, and validation coverage requested by issue #143.

## Phase 1 Dependency Verification

Verified locally against Phase 1 artifacts and source:

- `Role.SITE_ADMIN` exists and `Role.ADMIN` has been removed from the Prisma role enum.
- `Chapter`, `ChapterMembership`, `EventStaff`, `ApplicationTemplate`, `EventRegistration`, `EventRegistrationAudit`, `UserBan`, `UserBanFlag`, `HackerOrganizerNote`, and `HackerOrganizerNoteRevision` exist in `prisma/schema.prisma`.
- Event metadata includes chapter ownership, slug, status, visibility, capacity, public location, approved-only details, event questions, auto-promote waitlist, and application close fields.
- Shared helpers exist under `src/lib/` for event-management auth, chapters, application template composition, moderation/ban filtering, organizer notes, and internal registration/audit behavior.
- Existing organizer/admin routes exist for chapters, event creation/update/publish, staff assignment, and internal registration list/status update.
- Phase 1 task list is fully checked off, including focused tests and build/test validation tasks.

Phase 2 dependency gaps to address in this plan:

- `EventApplicationMode` currently uses Phase 1 placeholder values (`NONE`, `INTERNAL`, `PUBLIC_LATER`). Phase 2 must cut over to public behavior values, with `REQUIRES_APPROVAL` as the default and `OPEN_RSVP` available only if product enables non-approval RSVP.
- `EventRegistrationSource` currently includes `PUBLIC_LATER`; Phase 2 must cut over public submissions to `WEBSITE`.
- `applicationsOpen` is currently modeled as a nullable `DateTime`; Phase 2 needs an unambiguous open/closed state for manual closure and reopening.
- Public user-owned registration endpoints, application answer editing, cancellation, waitlist promotion, registration notes, and applications open/close endpoints do not exist yet and are in scope for Phase 2.

No Phase 1 blocker prevents planning. The gaps above are expected cutover work for native RSVP rather than missing Phase 1 foundations.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18, Next.js 14.2 App Router, Prisma 5.21, Node-based scripts.

**Primary Dependencies**: Next.js, React, Prisma Client, PostgreSQL, Clerk (`@clerk/nextjs`), Jest, React Testing Library, Tailwind CSS.

**Storage**: PostgreSQL via Prisma migrations and Prisma Client. Existing schema lives in `prisma/schema.prisma`; migrations live in `prisma/migrations/`.

**Testing**: Jest for unit/API/component tests through `npm run test`; coverage script via `npm run test:coverage`. Existing tests are under `tests/api`, `tests/components`, `tests/pages`, `tests/contexts`, `tests/lib`, and related folders.

**Target Platform**: Next.js web application deployed as server-rendered/client-rendered routes with API route handlers, backed by PostgreSQL.

**Project Type**: Web application with server-side API route handlers, React pages/components, and Prisma-managed data model.

**Performance Goals**: Public event listing and chapter pages should use indexed chapter/status/time lookups and avoid per-card permission queries. Registration review should filter by event/status with indexed registration and ban lookups. Public event detail should do one scoped event lookup plus one current-user registration lookup when signed in.

**Constraints**: Cutover only; do not keep long-term compatibility paths for placeholder Phase 1 public-registration enum values. Guest RSVPs, QR check-in/scanner, attendance migration, historical external-event import, public waitlist rank, custom chapter landing-page builder, production email/SMS delivery, and full pitch workspace replacement are out of scope. Global ban signals must remain hidden from non-site-admin workflows.

**Scale/Scope**: One Next.js app, one PostgreSQL schema, one public `/events` cutover, public event detail pages, public chapter directory/page updates, organizer event creation/review updates, user-owned registration actions, waitlist/capacity rules, shared helper updates, and focused tests for the phase 2 permission and visibility matrix.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file (`.specify/memory/constitution.md`) still contains placeholder template text and defines no enforceable project-specific gates. No constitutional violations are present for this plan.

Post-design re-check: PASS. The design stays within the existing Next.js/Prisma/Jest project shape, uses Phase 1 shared permission helpers, and documents public/private data boundaries for approved-only details, organizer notes, decline messages, global-ban filtering, and user-owned registration updates.

## Project Structure

### Documentation (this feature)

```text
specs/002-native-event-rsvp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   └── ui-surfaces.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
├── migrations/
└── seed.ts

src/
├── app/
│   ├── api/
│   │   ├── events/
│   │   └── chapters/
│   ├── events/
│   ├── chapters/
│   ├── organizer/
│   └── pitch/
├── lib/
├── types/
└── middleware.ts

tests/
├── api/
├── components/
├── lib/
├── pages/
└── middleware-comprehensive.test.ts
```

**Structure Decision**: Use the existing single Next.js application structure. Extend Prisma schema/migrations for public registration semantics, route handlers under `src/app/api/events`, public UI under `src/app/events` and `src/app/chapters`, organizer UI under `src/app/organizer/events`, shared behavior under `src/lib`, shared types under `src/types`, and tests in the existing Jest folders.

## Complexity Tracking

No constitution violations require complexity justification.
