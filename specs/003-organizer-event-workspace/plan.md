# Implementation Plan: Organizer Event Workspace

**Branch**: `003-event-workspace` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-organizer-event-workspace/spec.md` and GitHub issue #145, with parent issue #147 as redesign context.

## Summary

Cut over organizer event operations to `/organizer/events/[eventId]`, providing one permission-scoped workspace for overview, registration review, communications, materials, projects, pitch access, organizer notes, and a reporting preview. The implementation extends the existing Next.js App Router, Prisma/PostgreSQL event foundations, AWS SES/Twilio notification adapters, Google Cloud Storage integration, registration review, organizer notes, and `/pitch/[eventId]` controller. It adds auditable materials, communication snapshots and delivery results, staff changes, and event-specific project-card readiness while explicitly excluding phase 3 check-in/attendance behavior.

## Dependency Verification

- Phase 1 and Phase 2 event models, chapter roles, `EventStaff`, public event pages, native registrations, waitlists, global-ban filtering, organizer notes, and shared permission helpers exist locally.
- Staff create/delete routes, organizer registration review, and event settings surfaces exist but are not yet assembled under one workspace.
- `Project` is global and `PitchProject` links it to a `PitchSession`, whose `eventId` provides the event-specific participation boundary.
- `/pitch/[eventId]` already implements the pitch controller and recognizes MC and co-MC access.
- AWS SES and Twilio adapters already exist in `src/lib/eventDecisionNotifications.ts`; Google Cloud Storage upload support exists in `src/lib/gcp-storage.ts`.
- The current `canManageEventSettingsWithContext` grants MCs broader settings access than this specification allows, and `GET /api/events/[eventId]/staff` does not currently authorize reads. Both are required permission cutovers, not compatibility cases.
- Phase 3 issue #144 is intentionally deferred. No current `Week`/`Attendance` data may be represented as event attendance or used for workspace counts/audiences.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18, Next.js 14.2 App Router, Prisma 5.21, Node.js runtime.

**Primary Dependencies**: Next.js, React, Prisma Client, PostgreSQL, Clerk (`@clerk/nextjs`), Google Cloud Storage (`@google-cloud/storage`), AWS SES SDK, Twilio, Jest, React Testing Library, Tailwind CSS.

**Storage**: PostgreSQL for workspace state, audits, communication snapshots, and metadata; private Google Cloud Storage objects for uploaded event materials.

**Testing**: Jest unit, route-handler, page, and component tests through `npm run test`; Prisma schema/client validation through `npx prisma validate` and `npx prisma generate`; production validation through `npm run build`.

**Target Platform**: Next.js web application with server/client-rendered organizer surfaces and Node.js API route handlers, deployed with PostgreSQL and configured external delivery/storage providers.

**Project Type**: Single full-stack web application.

**Performance Goals**: Load workspace overview with bounded aggregate queries and no per-row permission queries; paginate registration, note, material, project, and communication collections; preview/send audiences from indexed event/status lookups; keep pitch-controller performance unchanged; authorize a material download with one event/material query plus current-user scope lookup.

**Constraints**: Cutover only. No legacy organizer workspace, duplicate project participation model, check-in, attendance/no-show claims, pitch rewrite, guest workflow, ban disclosure, automated social/newsletter publishing, historical import, or sponsor portal. Uploaded materials are limited to 25 MiB and a documented passive-file allowlist. Restricted objects must not have durable public URLs. Message sends must recalculate and snapshot recipients at confirmation time and never expose global-ban signals to non-site-admin organizers.

**Scale/Scope**: One organizer route shell with eight operational sections; new material, communication, recipient, staff-audit, and material-audit records; additions to event project participation and notification-consent metadata; expanded event-scoped APIs and shared authorization helpers; focused migrations and Jest coverage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current `.specify/memory/constitution.md` contains only template placeholders and defines no enforceable project-specific gates. Pre-design gate: PASS.

Post-design re-check: PASS. The design stays within the existing Next.js/Prisma/Jest application, reuses installed provider integrations, centralizes event-scoped permission checks, uses immutable audit/snapshot records for sensitive operations, and explicitly preserves public/private and moderation-data boundaries.

## Project Structure

### Documentation (this feature)

```text
specs/003-organizer-event-workspace/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   └── ui-surfaces.md
└── tasks.md                 # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
└── migrations/

src/
├── app/
│   ├── api/
│   │   ├── events/[eventId]/
│   │   │   ├── workspace/
│   │   │   ├── staff/
│   │   │   ├── materials/
│   │   │   ├── blasts/
│   │   │   ├── notes/
│   │   │   └── projects/
│   │   └── hackers/[hackerId]/organizer-note/
│   ├── events/[chapterSlug]/[eventSlug]/
│   ├── organizer/events/[eventId]/
│   └── pitch/[eventId]/
├── lib/
│   ├── eventManagementAuth.ts
│   ├── eventManagementApi.ts
│   ├── eventWorkspace.ts
│   ├── eventMaterials.ts
│   ├── eventCommunications.ts
│   ├── eventDelivery.ts
│   ├── gcp-storage.ts
│   └── organizerNotes.ts
└── types/

tests/
├── api/
├── components/
├── lib/
├── pages/
└── utils/
```

**Structure Decision**: Extend the existing single Next.js application. Use an event workspace shell under `src/app/organizer/events/[eventId]`, event-scoped route handlers under the existing API tree, shared pure/domain helpers in `src/lib`, Prisma migrations for durable state, and the existing Jest directory conventions. `/pitch/[eventId]` remains the focused controller reached from the workspace Pitch section.

## Complexity Tracking

No constitution violations require justification.
