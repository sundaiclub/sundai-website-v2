# Data Model: Organizer Event Workspace

## Existing Entities Changed

### Event

The workspace root. Existing event metadata, chapter, staff, registrations, and pitch sessions supply overview state.

**New relationships**

- `materials EventMaterial[]`
- `communications EventCommunication[]`
- `staffAudits EventStaffAudit[]`

**Rules**

- Workspace access is evaluated against current site role, active chapter-admin membership, or current event staff assignment.
- Lifecycle and staff actions remain admin-only.
- No phase 3 attendance relation is added.

### EventStaff

One event-scoped operational assignment per hacker.

**Existing fields**: `id`, `eventId`, `hackerId`, `role`, timestamps.

**Cutover**

- Replace `@@unique([eventId, hackerId, role])` with `@@unique([eventId, hackerId])`.
- If historical duplicate MC/co-MC rows exist for one hacker/event, migrate to MC because it is the higher existing capability and write/retain migration evidence before applying the constraint.
- Role changes update the one assignment and append an `EventStaffAudit` record.

### ChapterMembership

Existing chapter-scoped notification preference and consent boundary.

**New fields**

- `smsConsentAt DateTime?`
- `smsConsentVersion String?`

**Rules**

- SMS eligibility requires active membership, `notificationsAllowed`, `smsNotificationsEnabled`, both consent fields, a usable E.164 phone, and configured Twilio delivery.
- Email eligibility requires active membership, `notificationsAllowed`, `emailNotificationsEnabled`, a usable email, and configured SES delivery.

### PitchProject

Physical event-specific project participation through `PitchSession.eventId`.

**New field**

- `cardStatus EventProjectCardStatus @default(DRAFT)`

**Card states**

- `DRAFT`
- `NEEDS_INFO`
- `SUBMITTED`
- `APPROVED`

**Rules**

- Unique project participation remains `(pitchSessionId, projectId)`.
- Card status is reporting hygiene only and never blocks queue, voting, or pitching.
- A global `Project` may have entries in pitch sessions belonging to many events.

### HackerOrganizerNote / HackerOrganizerNoteRevision

Unchanged physical model: one current note per hacker and immutable revisions.

**Workspace rules**

- Event staff can read/edit only if the target hacker is relevant to the active event.
- Chapter admins can read/edit when relevant to an event in their chapter and can view revisions.
- MC/co-MC cannot view revisions.
- No public, attendee, message, material, project-public, or reporting response includes note data.

## New Entities

### EventMaterial

An event resource represented by a link or private uploaded object.

**Fields**

- `id String @id`
- `eventId String`
- `kind EventMaterialKind` (`LINK`, `FILE`)
- `visibility EventMaterialVisibility` (`PUBLIC`, `APPROVED_ATTENDEES`, `ORGANIZERS_ONLY`)
- `title String`
- `description String?`
- `externalUrl String?`
- `objectKey String?`
- `bucket String?`
- `originalFilename String?`
- `mimeType String?`
- `size Int?`
- `position Int @default(0)`
- `isAvailable Boolean @default(true)`
- `availableFrom DateTime?`
- `availableUntil DateTime?`
- `createdById String`
- `createdAt DateTime`
- `updatedAt DateTime`

**Relationships**

- Belongs to one `Event`.
- Created by one `Hacker`.
- Has many `EventMaterialAudit` records.

**Validation**

- `LINK` requires `externalUrl` with `https` and forbids object fields.
- `FILE` requires object key, bucket, original filename, allowed MIME/extension, and size `1..26,214,400` bytes; it forbids `externalUrl`.
- Object keys are opaque and unique.
- Availability requires `availableUntil > availableFrom` when both exist.
- Approved-attendee content is visible to approved registrations and organizers only.
- Organizer-only content is visible only to current authorized organizers.
- Deletion removes the active record, records an audit, and deletes/private-tombstones the object; audit history retains metadata but not a durable access URL.

**Indexes**

- `(eventId, visibility, isAvailable, position)`
- unique `objectKey` when present

### EventMaterialAudit

Immutable material-change history.

**Fields**

- `id String @id`
- `eventId String`
- `materialId String?` (nullable after deletion or retained with non-cascading relation strategy)
- `actorId String`
- `action EventMaterialAuditAction` (`CREATED`, `UPDATED`, `REORDERED`, `REMOVED`)
- `changeJson Json`
- `createdAt DateTime`

**Indexes**: `(eventId, createdAt)`, `(materialId, createdAt)`, `(actorId, createdAt)`.

### EventCommunication

A draft or completed event message and its frozen send definition.

**Fields**

- `id String @id`
- `eventId String`
- `createdById String`
- `sentById String?`
- `channel EventCommunicationChannel` (`EMAIL`, `SMS`)
- `status EventCommunicationStatus` (`DRAFT`, `SENDING`, `SENT`, `PARTIAL`, `FAILED`)
- `subject String?` (required for email, null for SMS)
- `body String`
- `audienceType EventCommunicationAudience`
- `audienceDefinitionJson Json`
- `previewFingerprint String?`
- `recipientCount Int @default(0)`
- `sentCount Int @default(0)`
- `failedCount Int @default(0)`
- `sentAt DateTime?`
- `createdAt DateTime`
- `updatedAt DateTime`

**Audience values**

- `ACTIVE_REGISTERED`
- `PENDING`
- `APPROVED`
- `WAITLISTED`
- `DECLINED`
- `SELECTED`

`CHECKED_IN` and `NO_SHOW` do not exist in this phase.

**State transitions**

```text
DRAFT -> SENDING -> SENT
                 -> PARTIAL
                 -> FAILED
```

- Draft content/audience can change only in `DRAFT`.
- Confirmation recalculates recipients; a fingerprint mismatch leaves the communication in `DRAFT`.
- Transition to `SENDING` and recipient snapshot creation occur atomically.
- Final aggregate state derives from recipient outcomes.
- Sent records are immutable except provider-result counters/state finalized by the send operation.

**Indexes**: `(eventId, createdAt)`, `(eventId, status, createdAt)`, `(createdById, createdAt)`.

### EventCommunicationRecipient

Immutable send-time recipient/contact snapshot plus delivery outcome.

**Fields**

- `id String @id`
- `communicationId String`
- `hackerId String`
- `registrationId String`
- `contactValue String` (organizer-only snapshot)
- `displayName String`
- `status EventCommunicationRecipientStatus` (`PENDING`, `SENDING`, `SENT`, `FAILED`)
- `providerMessageId String?`
- `errorCode String?`
- `errorMessage String?` (sanitized, organizer-only)
- `attemptedAt DateTime?`
- `deliveredAt DateTime?`
- `createdAt DateTime`
- `updatedAt DateTime`

**Rules**

- Unique `(communicationId, hackerId)`.
- Snapshot rows never change membership when registration status/preferences later change.
- Contact values and errors never appear in public or attendee responses.
- Registration status is never mutated by delivery outcomes.

**Indexes**: `(communicationId, status)`, `(hackerId, createdAt)`, `(registrationId)`.

### EventStaffAudit

Immutable history for staff assignment, role change, and removal.

**Fields**

- `id String @id`
- `eventId String`
- `staffHackerId String`
- `actorId String`
- `action EventStaffAuditAction` (`ASSIGNED`, `ROLE_CHANGED`, `REMOVED`)
- `fromRole EventStaffRole?`
- `toRole EventStaffRole?`
- `createdAt DateTime`

**Rules**

- Created in the same transaction as every staff mutation.
- Readable only by site admins and in-scope chapter admins.

**Indexes**: `(eventId, createdAt)`, `(staffHackerId, createdAt)`, `(actorId, createdAt)`.

## Derived Read Models

### Workspace Overview

- Public-safe event identity and URL.
- Organizer-visible settings and current capability flags.
- Staff list.
- Registration counts after role-appropriate global-ban filtering.
- Project/card and pitch counts from event pitch sessions.
- Material and communication counts.
- No attendance/check-in/no-show count.

### Event Notes Row

- Relevant hacker identity, current note body/update metadata, event registration/project context, and `canViewRevisions` capability.
- Globally blocked hackers are removed before rows and counts for non-site-admin viewers.

### Reporting Preview

- Registration funnel counts, project-card/pitch counts, material counts, and communication delivery totals.
- Deferred fields are returned as explicit unavailable labels, not zeroes.
