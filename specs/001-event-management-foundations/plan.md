# Implementation Plan: Event Management Foundations

**Branch**: `001-event-management-foundations` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-event-management-foundations/spec.md`

## Summary

Create the Phase 1 foundation for multi-chapter Sundai event operations by cutting over global event-management permissions from `ADMIN` to `SITE_ADMIN`, introducing chapters and chapter memberships, replacing `EventMC` with event-scoped `EventStaff`, and adding the schema/API/admin surfaces needed for application templates, internal registrations, global bans, and organizer notes. Public native RSVP/application/check-in pages remain out of scope; existing public `/events` and pitch workflows must keep working through shared server-side permission helpers.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18, Next.js 14.2 App Router, Prisma 5.21, Node-based scripts.

**Primary Dependencies**: Next.js, React, Prisma Client, PostgreSQL, Clerk (`@clerk/nextjs`), Jest, React Testing Library, Tailwind CSS.

**Storage**: PostgreSQL via Prisma migrations and Prisma Client. Existing schema lives in `prisma/schema.prisma`; migrations live in `prisma/migrations/`.

**Testing**: Jest for unit/API/component tests through `npm run test`; coverage script via `npm run test:coverage`. Existing tests are under `tests/api`, `tests/components`, `tests/pages`, `tests/contexts`, `tests/lib`, and related folders.

**Target Platform**: Next.js web application deployed as server-rendered/client-rendered routes with API route handlers, backed by PostgreSQL.

**Project Type**: Web application with server-side API route handlers, React pages/components, and Prisma-managed data model.

**Performance Goals**: Permission, chapter visibility, registration list, and ban-filtering helpers should use indexed lookups and avoid route-level N+1 checks. Existing pitch controls should remain responsive at current event sizes.

**Constraints**: Cutover only; do not preserve long-term compatibility with the old `Role.ADMIN` event-management path. Phase 1 must not expose new public native RSVP/application/approved-detail/user RSVP status/QR check-in flows. Global ban signals must remain hidden from non-site-admin workflows.

**Scale/Scope**: One Next.js app, one PostgreSQL schema, one initial Boston backfill, new admin/organizer/chapter UI routes, shared permission helpers, and tests for the core permission matrix and migration-sensitive behavior.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file (`.specify/memory/constitution.md`) still contains placeholder template text and defines no enforceable project-specific gates. No constitutional violations are present for this plan.

Post-design re-check: PASS. The design stays within the existing Next.js/Prisma/Jest project shape and documents the security-sensitive permission and visibility rules in shared helpers, API contracts, and focused tests.

## Project Structure

### Documentation (this feature)

```text
specs/001-event-management-foundations/
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
│   ├── admin/
│   ├── api/
│   ├── chapters/
│   ├── organizer/
│   ├── events/
│   └── pitch/
├── lib/
├── types/
└── middleware.ts

tests/
├── api/
├── components/
├── contexts/
├── lib/
├── pages/
└── middleware-comprehensive.test.ts
```

**Structure Decision**: Use the existing single Next.js application structure. Add server-side authorization and domain helpers under `src/lib/`, route handlers under `src/app/api/`, UI surfaces under `src/app/admin`, `src/app/chapters`, and `src/app/organizer`, and Prisma schema/migration work under `prisma/`.

## Complexity Tracking

No constitution violations require complexity justification.
