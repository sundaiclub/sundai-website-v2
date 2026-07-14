# HTTP API Contracts: Native Event Pages and RSVP

All endpoints use Next.js route handlers under `src/app/api`. JSON responses return `401` for unauthenticated actions, `403` for authenticated but unauthorized actions, `404` when the caller must not learn a private/unpublished resource exists, and `400` for validation failures.

## Public Events

### `GET /api/events`

Returns event lists. This endpoint is cut over from existing public listing behavior to native public event discovery while preserving organizer filtering for management surfaces.

**Query**

- `chapterSlug` optional chapter filter for public listing.
- `status=PUBLISHED` implied for public callers.
- `organizer=true` keeps existing organizer manageable-event behavior.

**Public response item**

```json
{
  "id": "event_123",
  "slug": "ai-build-night",
  "chapter": {
    "id": "chapter_123",
    "slug": "boston",
    "name": "Boston",
    "timezone": "America/New_York"
  },
  "title": "AI Build Night",
  "publicLocation": "Boston, MA",
  "startTime": "2026-07-10T22:00:00.000Z",
  "endTime": "2026-07-11T01:00:00.000Z",
  "publicStatus": "OPEN",
  "viewerRegistrationStatus": "PENDING"
}
```

**Rules**

- Public callers receive only upcoming `PUBLISHED` and `PUBLIC` events.
- Unpublished events never appear.
- Approved-only details are not included.
- `viewerRegistrationStatus` is included only when the signed-in viewer has a registration.

### `POST /api/events`

Creates an event. Site admins can create for any chapter; chapter admins can create for their own chapters. MCs and co-MCs cannot create by staff role alone.

**Body additions/changes**

```json
{
  "chapterId": "chapter_123",
  "title": "AI Build Night",
  "slug": "ai-build-night",
  "description": "Public event description",
  "publicLocation": "Boston, MA",
  "approvedDetailsJson": {
    "address": "Exact address",
    "toolkitUrl": "https://example.com/toolkit"
  },
  "startTime": "2026-07-10T22:00:00.000Z",
  "endTime": "2026-07-11T01:00:00.000Z",
  "capacity": 40,
  "applicationMode": "REQUIRES_APPROVAL",
  "autoPromoteWaitlist": false,
  "applicationQuestionsJson": [],
  "confirmationMessage": "See you soon.",
  "waitlistMessage": "You are on the waitlist.",
  "declineMessage": "We cannot accommodate your application this time."
}
```

**Rules**

- Missing `applicationMode` defaults to `REQUIRES_APPROVAL`.
- Missing `autoPromoteWaitlist` defaults to `false`.
- Event-level questions cannot override site-required fields.

### `GET /api/events/[eventId]`

Returns event details by id for existing consumers and management surfaces.

**Rules**

- Management reads require event-management permission.
- Public reads redact approved-only details unless the viewer is approved or an authorized organizer.

### `PATCH /api/events/[eventId]`

Updates event metadata according to event-management permission.

**Rules**

- Site admins and chapter admins can update all fields in their scope.
- MC/co-MC editing remains limited by existing helper semantics.
- Application mode cutover values are required.
- Manual application open/closed state should normally use the explicit open/close endpoints.

### `POST /api/events/[eventId]/publish`

Publishes a draft event. Site admins and chapter admins for the event chapter only.

## Public Event Detail By Slug

The route `/events/[chapterSlug]/[eventSlug]` may query Prisma directly from the page or call an API helper, but the contract is:

- Resolve by `chapter.slug` and `event.slug`.
- Return `404` for unpublished, non-public, or nonexistent events.
- Include public description, program/focus wording, public sponsor/expert text when present, public location, application controls, current user status, cancellation controls when applicable, and add-to-calendar payload.
- Include approved-only details only for approved registrants and authorized organizers.

## Public Registration Actions

### `POST /api/events/[eventId]/registrations`

Creates the current signed-in user's public registration/application. The existing internal organizer behavior must be separated by permission or moved to an explicit internal path during implementation.

**Body**

```json
{
  "answersJson": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "why_this_event": "I want to build."
  }
}
```

**Response**

```json
{
  "id": "registration_123",
  "status": "PENDING",
  "submittedAt": "2026-06-22T16:00:00.000Z",
  "publicSafeMessage": null
}
```

**Rules**

- Requires signed-in user.
- No guest submissions.
- Rejects duplicate active registration with current status response.
- Blocks submission when applications are manually closed.
- Validates required fields from the composed snapshot.
- Stores answers and template snapshot.
- Active global ban creates or updates a `BLOCKED` registration and returns only the generic message.
- Approval-required events create `PENDING`.

### `PATCH /api/events/[eventId]/registrations/me`

Updates the current signed-in user's answers while pending.

**Rules**

- Allowed only for `PENDING`.
- Preserves `submittedAt`.
- Updates `answersJson`, `templateSnapshotJson`, and `updatedAt`.
- Writes an audit entry.
- Denies edits for approved, waitlisted, declined, blocked, or cancelled registrations.

### `POST /api/events/[eventId]/registrations/me/cancel`

Cancels the current signed-in user's registration.

**Rules**

- Allowed for pending, approved, and waitlisted registrations.
- Sets status to `CANCELLED`, `cancelledAt`, and `cancelledById`.
- Writes an audit entry.
- If the cancelled registration was approved and auto-promotion is enabled, promotes the oldest eligible waitlisted registration when capacity allows.

## Organizer Registration Review

### `GET /api/events/[eventId]/registrations`

Returns registration review rows for authorized organizers.

**Query**

- `status=PENDING|APPROVED|WAITLISTED|DECLINED|CANCELLED`
- `includeBannedUsers=true` site-admin-only.

**Rules**

- Site admins, chapter admins, and assigned MCs can review.
- Assigned co-MCs can view context and add notes but cannot decide.
- Non-site-admin results exclude active globally banned users without exposing counts, state, reasons, or signals.
- Site-admin-only context may show blocked registrations and ban state.

### `PATCH /api/events/[eventId]/registrations/[registrationId]`

Updates organizer-controlled registration status.

**Body**

```json
{
  "status": "APPROVED",
  "publicSafeMessage": "You are approved.",
  "internalReviewNotes": "Internal note"
}
```

**Rules**

- MCs, chapter admins, and site admins can approve, waitlist, and decline.
- Co-MCs cannot approve, waitlist, or decline.
- Public decline responses use public message text, never internal notes.
- Status changes write audit records.

### `POST /api/events/[eventId]/registrations/[registrationId]/notes`

Updates event-specific internal review notes.

**Body**

```json
{
  "internalReviewNotes": "Useful organizer context"
}
```

**Rules**

- Site admins, chapter admins, assigned MCs, and assigned co-MCs can add notes in authorized event context.
- Writes an audit entry.
- Notes never appear in public detail, status, decline, waitlist, or calendar responses.

### `POST /api/events/[eventId]/registrations/[registrationId]/cancel`

Organizer cancellation/admin removal.

**Rules**

- Site admins, chapter admins, and assigned MCs can cancel.
- Co-MCs cannot cancel unless implementation explicitly treats cancellation as note-only support, which is not required by the spec.
- Approved cancellation follows the same auto-promotion transaction rule.

## Application Open/Close

### `POST /api/events/[eventId]/applications/close`

Closes applications manually.

**Body**

```json
{
  "reason": "Capacity reached for this format"
}
```

**Rules**

- Site admins, chapter admins, and assigned MCs may close applications.
- New submissions are blocked.
- Existing registrations remain reviewable.
- Writes an audit or event-change record.

### `POST /api/events/[eventId]/applications/open`

Reopens applications manually.

**Rules**

- Same permissions as close.
- Clears closed metadata and permits new submissions when other checks pass.

## Chapters

### `GET /api/chapters`

Returns active chapters for public directory and existing manageable chapter behavior for organizer surfaces.

**Public response additions**

- `nextEvent` optional next published event summary.

### `GET /api/chapters/[chapterIdOrSlug]`

Returns chapter page data.

**Response additions**

- `upcomingEvents` list of upcoming published events.
- `mailingListName` or provider-neutral CTA metadata when configured.

## Add To Calendar

Add-to-calendar may be generated client-side from public event detail or exposed through a small helper endpoint. Calendar output must include public title, public location summary, and public description only unless the viewer is approved and explicitly generating an approved-user calendar entry.
