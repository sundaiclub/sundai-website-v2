# Research: Event Management Foundations

## Decision: Use a cutover from `Role.ADMIN` to `Role.SITE_ADMIN`

**Rationale**: The feature explicitly requires removing dependence on the prior single global admin role name for event-management permissions. A cutover aligns Prisma enum values, seed data, middleware, context state, API route checks, and tests around the same permission vocabulary.

**Alternatives considered**: Keeping both `ADMIN` and `SITE_ADMIN` as aliases was rejected because the project instruction says no legacy fallback paths are needed and dual role names would weaken permission tests.

## Decision: Centralize event-management authorization in server-side helpers

**Rationale**: Existing checks are scattered across client context, middleware, API route handlers, project moderation, and pitch routes. Shared helpers make the permission matrix testable and keep ban and private-chapter visibility decisions below UI code.

**Alternatives considered**: Updating each route inline was rejected because it would preserve duplicated authorization logic and make chapter/event-scoped roles hard to reason about.

## Decision: Model chapters and membership as first-class Prisma entities

**Rationale**: Chapters must support public/private visibility, multiple memberships per user, chapter admins, invitation state, and future notification preferences. A dedicated `ChapterMembership` record with role, status, invitation metadata, and notification fields matches those requirements directly.

**Alternatives considered**: A single chapter field on `Hacker` was rejected because users can belong to multiple chapters and private chapter invitations need per-chapter state.

## Decision: Replace `EventMC` with `EventStaff`

**Rationale**: Phase 1 needs event-scoped MC and co-MC roles with different permissions. Replacing the existing MC join table with a typed staff assignment table allows pitch continuity while adding co-MC operational access.

**Alternatives considered**: Adding a loose string role to `EventMC` was rejected because the current model name and usage encode only MC behavior, making co-MC semantics harder to test and maintain.

## Decision: Store Phase 1 application templates as structured JSON field definitions

**Rationale**: Application templates will later drive validation, prefill, and review. A structured JSON field list with stable IDs, labels, input types, required flags, and profile bindings is enough for Phase 1 without building a full form-builder model.

**Alternatives considered**: Markdown/free-text templates were rejected because they cannot reliably enforce site-required name/email fields. Fully normalized question tables were deferred to avoid overbuilding before the public RSVP flow.

## Decision: Add internal registration records without public registration behavior

**Rationale**: Later RSVP/review/check-in phases need a native registration target shape, but Phase 1 explicitly must not expose public application or RSVP pages. Keeping routes internal/organizer-gated lets schema and permission work land without creating public UX commitments.

**Alternatives considered**: Waiting to add registration tables until the RSVP phase was rejected because application template composition, ban filtering, and organizer note relevance need a stable foundation.

## Decision: Implement global bans and ban flags as separate records

**Rationale**: Site admins own permanent global bans, while chapter admins may only request review. Separate `UserBan` and `UserBanFlag` records preserve that trust boundary and support auditability without exposing ban counts or reasons to lower-trust workflows.

**Alternatives considered**: Letting chapter admins create chapter/event bans was rejected because temporary, chapter-specific, and event-specific bans are out of Phase 1 scope.

## Decision: Store one current organizer note plus text-patch revisions

**Rationale**: Organizers need current context in workflows, and site/chapter admins need revision visibility. A current note table plus revision records supports quick reads and audit history while keeping regular users and lower-trust roles away from revision history.

**Alternatives considered**: Storing only append-only comments was rejected because the requirement is one current internal note body. Storing full snapshots only was rejected because settled feedback calls for text patches.

## Decision: Keep existing public `/events` behavior unchanged in Phase 1

**Rationale**: The phase goal is foundations, not the public event discovery replacement. Leaving the Google Calendar page largely unchanged avoids exposing incomplete native RSVP/application/check-in surfaces.

**Alternatives considered**: Building native event detail and RSVP pages now was rejected because those pages are explicitly Phase 2/3 work.
