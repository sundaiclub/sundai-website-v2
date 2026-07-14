# Research: Native Event Pages and RSVP

## Phase 1 Foundation Readiness

**Decision**: Treat Phase 1 as complete enough to build Phase 2, but include a required schema cutover for public RSVP enum/state semantics.

**Rationale**: Local source contains the Phase 1 database models, auth helpers, internal registration helpers, organizer note helpers, global-ban filtering, chapter UI/API routes, event staff routes, and internal registration routes needed by issue #143. The only mismatch is that Phase 1 intentionally used future-placeholder enum values for application mode and registration source, and `applicationsOpen` is a nullable timestamp rather than a clear open/closed state.

**Alternatives considered**: Blocking Phase 2 until Phase 1 issue #142 is closed on GitHub was rejected because local tasks and code artifacts indicate the foundations are present. Keeping `PUBLIC_LATER` compatibility was rejected because project instructions prefer cutovers.

## Application Mode Semantics

**Decision**: Replace Phase 1 placeholder `EventApplicationMode` values with public behavior values: `REQUIRES_APPROVAL` as the default and `OPEN_RSVP` for direct approval if enabled. Do not add guest or invite-only behavior in Phase 2.

**Rationale**: Issue #143 explicitly requires approval-required as the default and no guest RSVPs. The spec still allows an application mode field, so `OPEN_RSVP` keeps the model ready for direct RSVP without adding guest behavior or invite-only workflows.

**Alternatives considered**: Keeping `NONE`, `INTERNAL`, and `PUBLIC_LATER` would make public logic branch around placeholder names. Adding `INVITE_ONLY` now was rejected because invite-only event behavior is outside the current phase.

## Application Open/Closed State

**Decision**: Cut over to explicit application state fields: `applicationsOpen Boolean @default(true)`, plus `applicationsClosedAt`, `applicationsClosedById`, and `applicationsCloseReason`.

**Rationale**: Manual close/reopen is a user-facing Phase 2 workflow. A nullable timestamp named `applicationsOpen` is ambiguous and makes route logic harder to audit.

**Alternatives considered**: Reusing the nullable DateTime was rejected because it does not clearly represent reopening and would require extra convention in every public submission check.

## Application Composition And Snapshots

**Decision**: Continue using Phase 1 application template composition in `src/lib/applicationTemplates.ts`, and snapshot the rendered fields into `EventRegistration.templateSnapshotJson` at submission.

**Rationale**: This already supports site, chapter, and event merge order and protects historical answers when templates change. Phase 2 only needs to use the helper from public submission and pending-edit paths.

**Alternatives considered**: Normalizing every question into SQL rows was rejected because current requirements do not require per-question reporting, and Phase 1 already chose JSON schema fields.

## Public Profile Prefill

**Decision**: Prefill stable fields from the signed-in hacker profile when field ids match known profile attributes (`name`, `email`, profile links, bio/background where available), while still validating submitted answers server-side.

**Rationale**: The requirement asks recurrent hackers not to re-enter stable profile data, but the application snapshot remains the source of truth for a specific event submission.

**Alternatives considered**: Updating the profile automatically from every answer was rejected because that would mix application answers with profile editing without explicit user intent.

## Approved-Only Details

**Decision**: Store sensitive details in `Event.approvedDetailsJson` and reveal them only to approved users and authorized organizers. Public and non-approved responses must omit the field entirely or return a null/redacted value.

**Rationale**: Issue #143 lists exact address, Zoom, Discord, toolkit links, and credentials as approved-only resources. The Phase 1 model already has `approvedDetailsJson`.

**Alternatives considered**: Keeping separate columns for every sensitive resource was rejected because the exact approved-only resource list is intentionally flexible.

## Ban Filtering And Blocked Submissions

**Decision**: On public registration submission, detect active global bans server-side and create or update a `BLOCKED` registration, return only the generic public-safe message, and hide banned applicants from all non-site-admin queues.

**Rationale**: This satisfies issue #143's settled rule that chapter admins receive no signal and users see only: "You are unable to register for this event at this time."

**Alternatives considered**: Returning a normal declined state was rejected because it may imply an organizer decision and confuse audit history. Exposing ban status to chapter admins or MCs is prohibited.

## Organizer Notes And Registration Notes

**Decision**: Use Phase 1 `HackerOrganizerNote` for shared hacker context and `EventRegistration.internalReviewNotes` with audit entries for event-specific registration notes.

**Rationale**: Phase 1 already provides one shared internal note per hacker and an auditable revision history. Phase 2 needs review-context notes without exposing them publicly.

**Alternatives considered**: Adding a new registration-note table now was rejected because the current single-note-per-registration requirement can be audited through `EventRegistrationAudit`.

## Waitlist Auto-Promotion

**Decision**: Implement automatic waitlist promotion as a transaction triggered when an approved registration is cancelled and `autoPromoteWaitlist` is true. Promote the oldest waitlisted registration by `createdAt` or waitlist transition timestamp if one is added.

**Rationale**: The workflow must be deterministic, capacity-safe, and auditable. Transactional promotion prevents overbooking under concurrent cancellations.

**Alternatives considered**: Background jobs were rejected because no external delivery provider is required in this phase and promotion should be immediately visible in product state.

## Notifications

**Decision**: Deliver approval and decline decisions through AWS SES email and Twilio SMS when the applicant has an active membership in the event's chapter, has globally allowed notifications for that membership, has enabled the corresponding channel, and has a usable contact value. Keep the in-product status and public message as the source of truth; notification delivery failures do not roll back the registration decision.

**Rationale**: Decision notifications are transactional messages tied to a user-visible status change. Reusing the existing chapter-level master and channel preferences avoids introducing a second consent model, while committing status before delivery keeps registration state authoritative during provider outages.

**Alternatives considered**: Rolling back a decision when delivery fails was rejected because an external provider outage must not corrupt organizer actions. Sending to every applicant regardless of membership preferences was rejected because it would bypass existing channel consent.

## Chapter Pages

**Decision**: Use the existing Phase 1 `/chapters` and `/chapters/[chapterSlug]` surfaces, updating them to show active chapters, next/upcoming published events, and mailing-list CTA text when configured. Do not add a custom chapter homepage builder.

**Rationale**: This directly matches issue #143 and uses Phase 1 chapter visibility helpers.

**Alternatives considered**: A marketing-page builder was rejected because the issue explicitly excludes bespoke standalone chapter homepages.

## Pitch Workspace Relationship

**Decision**: Keep `/pitch` and `/pitch/[eventId]` alive and link from native event pages where relevant. Do not merge the pitch queue into event management in Phase 2.

**Rationale**: Phase 2 replaces event discovery and RSVP, not pitch operations. Phase 1 already preserved pitch access with `EventStaff`.

**Alternatives considered**: Rebuilding the pitch workspace was rejected as out of scope and higher risk.
