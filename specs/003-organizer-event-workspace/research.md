# Research: Organizer Event Workspace

## Workspace Composition

**Decision**: Build `/organizer/events/[eventId]` as the sole organizer entry point with section navigation for Overview, RSVPs, Communications, Materials, Projects, Pitch, Notes, and Reporting preview. Each request re-evaluates event-scoped access; the page shell does not confer authority to child APIs.

**Rationale**: The feature's core value is one event context, while server-side checks protect against stale tabs and removed staff assignments. A shared shell avoids duplicating event identity, role messaging, loading states, and navigation.

**Alternatives considered**: Independent organizer pages without a shell were rejected because they preserve the fragmented workflow. A single monolithic page that eagerly loads every section was rejected because it would mix permissions and make large registration/project/message datasets expensive.

## Permission Cutover

**Decision**: Add explicit helpers for workspace access, event-settings editing, event administration, applicant decisions, operational editing, communications, materials, notes, and pitch. Site admins and in-scope chapter admins administer events and staff; assigned MCs may edit event settings; co-MCs may not. MCs and co-MCs operate the workspace, while only MCs and admins decide applicants. Staff reads require workspace authorization.

**Rationale**: Capability-specific helpers make the role matrix testable and let assigned MCs maintain event details without inheriting lifecycle or staffing authority.

**Alternatives considered**: UI-only hiding was rejected because direct API calls would retain excessive authority. Keeping the broad helper and adding route exceptions was rejected because permission drift would continue.

## Pitch Route Integration

**Decision**: Keep `/pitch/[eventId]` as the canonical focused pitch controller. The workspace Pitch section shows event pitch state and launches that controller. It is a maintained product surface, not a compatibility route; organizer discovery cuts over to the workspace.

**Rationale**: The existing page is a large, working controller with queue, timer, voting, and phase behavior. The issue explicitly says not to redesign it, while the spec requires direct event-context access.

**Alternatives considered**: Embedding or moving the entire controller into the workspace now was rejected as an unnecessary pitch rewrite. Redirecting `/pitch/[eventId]` to a summary-only workspace tab was rejected because it would remove focused presentation controls.

## Event Project Participation

**Decision**: Use `EventProject` as the event-participation source of truth and keep `PitchProject` solely for pitch-session queue and outcome state. Keep `Project` global. Creating a project during a relevant chapter event creates `EventProject`; adding a project to an event pitch session upserts the same participation atomically.

**Rationale**: Event participation must exist even when an event has no pitch session. Separating participation/card readiness from optional pitch state avoids manufacturing pitch sessions while the unique `(eventId, projectId)` record prevents duplicate event membership.

**Alternatives considered**: Using only `PitchProject` was rejected because non-pitching events cannot own projects. Creating a synthetic pitch session was rejected because it would misrepresent event operations.

## Material Storage And Access

**Decision**: Store upload metadata in PostgreSQL and file bytes as private Google Cloud Storage objects. The browser uploads to a short-lived signed PUT URL; the create/finalize request verifies object metadata before creating the active material record. Downloads go through an authorization endpoint that returns a short-lived signed GET redirect. Link materials store an `https` URL and use the same visibility-filtered listing contract.

**Rationale**: Direct upload avoids routing large files through the application runtime, while private objects and authorization-checked downloads enforce visibility even when an object key is known. Finalization can delete invalid orphaned objects without leaving a material row.

**Alternatives considered**: Durable public GCS URLs were rejected because approved/organizer-only content would be retrievable outside the app. Storing bytes in PostgreSQL was rejected because it burdens database backups and request handling. Proxying every byte through Next.js was rejected because it adds runtime bandwidth and timeout risk.

## Material Upload Policy

**Decision**: Limit files to 25 MiB and allow PDF, plain text, Markdown, CSV, PNG, JPEG, WebP, GIF, DOCX, XLSX, and PPTX. Reject SVG, HTML, scripts, archives, executables, and MIME/extension mismatches. Normalize display names, generate opaque object keys, and require `https` for link materials. Show this policy before file selection.

**Rationale**: The allowlist covers slides, briefs, spreadsheets, images, and lightweight operational documents while excluding common active-content and archive risks. A fixed limit makes client and server validation consistent.

**Alternatives considered**: Allowing every MIME type was rejected because uploaded active content can become a security and support burden. An image-only policy was rejected because slides and sponsor/toolkit documents are explicit use cases.

## Communication Delivery

**Decision**: Reuse AWS SES for email and Twilio for SMS through a provider-neutral delivery adapter. A channel is enabled only when its provider is configured. Sending atomically freezes the audience definition and recipient/contact snapshot, then records each provider outcome independently; registration state never changes because of delivery results.

**Rationale**: Both SDKs and decision-notification patterns already exist. Provider-neutral domain records keep history stable if a provider changes and satisfy partial-failure auditing.

**Alternatives considered**: Adding a second email/SMS stack was rejected as redundant. Recording only an aggregate send result was rejected because it cannot explain partial delivery failures or preserve recipient history.

## Audience Preview And Confirmation

**Decision**: Resolve previews from current registration state and channel eligibility. Return a deterministic preview fingerprint. At send, recalculate the audience; if the fingerprint changed, return `409` with a replacement preview and require confirmation again. On successful confirmation, create immutable recipient rows inside the send transaction.

**Rationale**: This prevents a stale preview from silently contacting a different audience while honoring the requirement that send-time state is authoritative.

**Alternatives considered**: Sending the previewed IDs without rechecking was rejected because status, cancellation, consent, and ban state can change. Silently accepting a changed count was rejected because the organizer must see the final audience.

## Consent And Preferences

**Decision**: Continue using active event-chapter membership notification fields as the master/channel preference boundary established in Phase 2. SMS additionally requires a usable E.164 phone value and a recorded, versioned SMS consent timestamp; email requires a usable address. Until approved consent copy/version is configured and captured, SMS remains disabled for recipient eligibility even if Twilio is configured.

**Rationale**: Existing chapter-level preferences already govern event decision notifications. Adding evidence fields makes SMS consent auditable without inventing a separate event-level preference system, and feature gating avoids treating an unchecked preference as legal consent.

**Alternatives considered**: Treating possession of a phone number as consent was rejected. Hardcoding unreviewed legal language was rejected; the configured consent version is an explicit launch requirement rather than an unresolved implementation choice.

## Audience Privacy And Global Bans

**Decision**: Non-site-admin audience previews and snapshots exclude globally blocked hackers before counts are produced. Exclusions are reported only in aggregate neutral categories such as `ineligible`, never as ban counts or reasons. Selected-recipient search uses the same filtered source. Site-admin-only restricted selection, if later enabled by policy, must be explicit and is not part of the default send flow.

**Rationale**: The ban boundary applies to counts, queues, notes, projects, communications, and exports. Filtering before aggregation prevents inference.

**Alternatives considered**: Showing a separate blocked exclusion count was rejected because it reveals moderation state. Returning hidden rows with redacted names was rejected because row count still leaks a signal.

## Organizer Notes

**Decision**: Reuse `HackerOrganizerNote` and revisions, but require event scope for workspace reads and writes. Add event-scoped list/search APIs and cut over direct hacker-note APIs so MC/co-MC access cannot be inferred from unrelated events. Admin revision access remains chapter/event scoped.

**Rationale**: The current global note is the settled shared-notepad model, but workspace access must prove target relevance to the active event on every request.

**Alternatives considered**: Creating per-event notes was rejected because the product decision is one shared note per hacker. Trusting a client-provided relevance flag was rejected because relevance must come from database relations.

## Auditing

**Decision**: Preserve existing registration audits and organizer-note revisions; add immutable staff and material audit records plus immutable communication/recipient records. Every audit stores actor and timestamp, with structured change data sufficient to reconstruct the operation without exposing it publicly.

**Rationale**: Separate domain histories are easy to query and align with existing patterns. Removed staff/material rows still retain their audit trail.

**Alternatives considered**: A single polymorphic audit table was rejected because Prisma cannot enforce polymorphic foreign keys and every reader would need bespoke validation.

## Deferred Check-In And Reporting

**Decision**: Omit Check-in from navigation, APIs, counts, and audience enums. Reporting preview labels attendance/check-in/no-show metrics unavailable and uses only registration, project-card, pitch, material, and communication data produced by completed phases.

**Rationale**: Phase 3 is intentionally being redesigned, and legacy `Week`/`Attendance` data is not event-native.

**Alternatives considered**: Mapping legacy attendance heuristically was rejected because it would create an unreliable source of truth and a compatibility path the project does not want.
