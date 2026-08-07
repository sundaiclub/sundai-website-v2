# HTTP API Contract: Organizer Event Workspace

All routes use Next.js route handlers. `401` means unauthenticated, `403` means authenticated but unauthorized, `404` hides nonexistent or non-disclosable resources, `400` means invalid input, and `409` means state changed and the caller must refresh/reconfirm. Every write rechecks current event/chapter/staff scope.

## Workspace

### `GET /api/events/[eventId]/workspace`

Returns event identity, capability flags, overview aggregates, staff, public URL, and section availability.

```json
{
  "event": {
    "id": "event_123",
    "title": "AI Build Night",
    "status": "PUBLISHED",
    "chapter": { "id": "chapter_1", "name": "Boston", "slug": "boston" },
    "startTime": "2026-07-18T14:00:00.000Z",
    "endTime": "2026-07-18T22:00:00.000Z",
    "capacity": 80,
    "applicationMode": "REQUIRES_APPROVAL",
    "autoPromoteWaitlist": false,
    "publicUrl": "/events/boston/ai-build-night",
    "hasApprovedOnlyDetails": true
  },
  "capabilities": {
    "administerEvent": false,
    "assignStaff": false,
    "decideApplicants": false,
    "manageOperations": true,
    "sendCommunications": true,
    "manageMaterials": true,
    "managePitch": true,
    "editNotes": true,
    "viewNoteHistory": false
  },
  "counts": {
    "registrations": {
      "pending": 10,
      "approved": 42,
      "waitlisted": 7,
      "declined": 3,
      "cancelled": 2
    },
    "projects": { "total": 12, "submittedCards": 9 },
    "pitch": { "queued": 8, "pitched": 4, "highlighted": 2 },
    "materials": 6,
    "communications": 3
  },
  "unavailable": ["checkIn", "attendance", "noShows"]
}
```

Non-site-admin counts are calculated after hidden global-ban rows are removed. No hidden count is returned.

## Staff

### `GET /api/events/[eventId]/staff`

Requires workspace access. Returns the current staff list; it no longer permits anonymous reads.

### `POST /api/events/[eventId]/staff`

Requires site admin or in-scope chapter admin.

```json
{ "hackerId": "hacker_1", "role": "MC" }
```

Creates the assignment or changes its one role. Writes `EventStaffAudit` in the same transaction.

### `DELETE /api/events/[eventId]/staff/[staffId]`

Requires site admin or in-scope chapter admin. Deletes the assignment and writes a removal audit atomically.

## Materials

### `GET /api/events/[eventId]/materials`

Returns only materials visible to the caller:

- anonymous/public: available `PUBLIC` rows;
- approved attendee: available `PUBLIC` and `APPROVED_ATTENDEES` rows;
- current organizer: all rows and management metadata.

Organizer-only rows do not affect public counts.

### `POST /api/events/[eventId]/materials/upload-intents`

Requires material-management capability.

```json
{
  "filename": "sponsor-brief.pdf",
  "mimeType": "application/pdf",
  "size": 481230
}
```

Validates the 25 MiB allowlist policy and returns an opaque upload token/object key plus a short-lived signed PUT URL. It does not create an `EventMaterial` row.

### `POST /api/events/[eventId]/materials`

Creates either a link or finalized uploaded file.

Link body:

```json
{
  "kind": "LINK",
  "title": "Brainstorming board",
  "externalUrl": "https://example.com/board",
  "visibility": "APPROVED_ATTENDEES",
  "position": 20
}
```

File body:

```json
{
  "kind": "FILE",
  "title": "Sponsor brief",
  "uploadToken": "signed-upload-token",
  "visibility": "ORGANIZERS_ONLY",
  "position": 30
}
```

For a file, the server verifies the private object's key, size, and content type before creating the material and audit in one transaction. Invalid objects are deleted and no material row is created.

### `PATCH /api/events/[eventId]/materials/[materialId]`

Updates title, description, visibility, ordering, and availability. Kind/object identity cannot change; replace a file by creating a new material. Writes an audit entry.

### `DELETE /api/events/[eventId]/materials/[materialId]`

Requires material-management capability. Records removal and removes the material/object without leaving a durable content URL.

### `GET /api/events/[eventId]/materials/[materialId]/content`

Re-evaluates current visibility and availability. For an allowed file, redirects to a short-lived signed GET URL with safe download/content-disposition metadata. For a link, the listing response supplies the authorized `externalUrl`; this route is file-only.

## Communications (`blasts`)

### `GET /api/events/[eventId]/blasts`

Requires communication capability. Returns paginated drafts/history and aggregate results. Recipient details are loaded only from the single-message endpoint.

### `POST /api/events/[eventId]/blasts`

Creates a draft.

```json
{
  "channel": "EMAIL",
  "subject": "Tomorrow's build night",
  "body": "Doors open at 9:30.",
  "audienceType": "APPROVED",
  "audienceDefinition": { "statuses": ["PENDING", "APPROVED"] }
}
```

Allowed audiences: `ACTIVE_REGISTERED`, `PENDING`, `APPROVED`, `WAITLISTED`, `DECLINED`, and `SELECTED`. Checked-in/no-show audiences are rejected.
The optional `audienceDefinition.statuses` array combines one or more registration-status audiences into a single recipient union. Each channel remains a separate draft so its consent, preview, delivery outcome, and history are independently auditable.

### `PATCH /api/events/[eventId]/blasts/[blastId]`

Updates content/channel/audience only while `DRAFT`.

### `POST /api/events/[eventId]/blasts/[blastId]/preview`

Resolves the current eligible audience and returns:

```json
{
  "channel": "EMAIL",
  "eligibleCount": 42,
  "exclusions": {
    "cancelled": 2,
    "missingContact": 1,
    "preferenceDisabled": 3,
    "ineligible": 0
  },
  "previewFingerprint": "sha256:..."
}
```

For non-site-admin callers, global-ban filtering happens before all rows/counts and is folded into a neutral eligibility result; no ban category or hidden count is returned.

### `POST /api/events/[eventId]/blasts/[blastId]/send`

```json
{ "previewFingerprint": "sha256:..." }
```

Recomputes the audience. If it differs, returns `409` with a replacement preview and sends nothing. Otherwise atomically changes the draft to `SENDING` and creates recipient snapshots, then sends through the selected configured provider and records each outcome. The final response reports `SENT`, `PARTIAL`, or `FAILED`. Retrying a non-draft send returns its current state rather than creating a second snapshot.

### `GET /api/events/[eventId]/blasts/[blastId]`

Returns immutable audience definition, content, sender, timestamps, aggregate results, and paginated recipient outcomes to authorized organizers. Contact snapshots and errors are organizer-only.

## Notes

### `GET /api/events/[eventId]/notes`

Returns paginated hackers relevant to registrations/projects in this event and their current shared organizer note. Supports server-side search. Non-site-admin callers receive no globally blocked rows or counts.

### `GET /api/events/[eventId]/notes/[hackerId]`

Returns the current shared notepad only when the target is relevant to this event and the caller currently has event access.

### `PUT /api/events/[eventId]/notes/[hackerId]`

```json
{ "body": "Prefers a quiet demo setup." }
```

Creates/updates the shared note and revision in one transaction after event relevance is verified.

### `GET /api/events/[eventId]/notes/[hackerId]/revisions`

Site admins and in-scope chapter admins only. MC/co-MC receive `403` even though they may read the current note.

Existing `/api/hackers/[hackerId]/organizer-note` routes are cut over to require explicit event/chapter scope or are removed after workspace consumers migrate; no unscoped MC/co-MC path remains.

## Projects And Pitch

### `GET /api/events/[eventId]/projects`

Requires workspace access. Returns projects through the event's pitch session(s), including global project/team/link/tag data and event-specific card status, queue position/status, pitch completion, vote-derived/top-project state, and highlight state.

### `PATCH /api/events/[eventId]/projects/[eventProjectId]`

Authorized organizers may update `cardStatus` for reporting hygiene. It cannot block or mutate pitch eligibility.

### Existing pitch APIs

Existing `/api/events/[eventId]/pitch/*` routes remain the controller contract but cut over to the shared event pitch capability helper for site admin, in-scope chapter admin, MC, and co-MC. Hacker-owned queue/voting permissions remain unchanged.

## Reporting Preview

### `GET /api/events/[eventId]/reporting-preview`

Returns only completed-phase metrics: registration funnel, project-card states, queue/pitch/highlight totals, material totals, and communication delivery totals. Attendance, check-in, and no-show fields are returned as unavailable descriptors or omitted, never as `0` or inferred legacy values.

## Public Event Material Integration

Public event detail may call the materials read helper directly or the public form of `GET /api/events/[eventId]/materials`. It exposes public material metadata and authorized approved-attendee material only. It never serializes storage bucket/object keys, organizer-only rows, communication records, organizer notes, audits, or moderation data.
