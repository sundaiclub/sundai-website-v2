# Data Model: Event Management Foundations

## Existing Entities Changed

### Hacker

Existing user/profile record keyed by Clerk identity.

**Field changes**

- `role`: replace `ADMIN` enum value with `SITE_ADMIN`.
- Add relations to chapter memberships, event staff assignments, created/revoked bans, ban flags, organizer notes, and note revisions.

**Validation rules**

- Event-management global authority is granted only by `role = SITE_ADMIN`.
- Regular users never receive organizer notes, note revisions, ban records, or internal ban flags through public/user APIs.

### Event

Chapter-owned gathering with existing pitch fields plus future RSVP/review metadata.

**New fields**

- `chapterId`
- `slug`
- `status`
- `visibility`
- `programType`
- `publicProgramLabel`
- `capacity`
- `applicationMode`
- `autoPromoteWaitlist`
- `endTime`
- `venueName`
- `publicLocation`
- `address`
- `virtualUrl`
- `approvedDetailsJson`
- `applicationQuestionsJson`
- `hideChapterDefaultQuestions`
- `applicationsOpen`
- `applicationsCloseReason`
- `checkInOpensAt`
- `checkInClosesAt`

**Relationships**

- Belongs to one `Chapter`.
- Has many `EventStaff`, `EventRegistration`, and `EventRegistrationAudit` records.
- Keeps existing `EventProject` pitch queue relations.

**Validation rules**

- `(chapterId, slug)` must be unique.
- `slug` must be readable and URL-safe; migration generates unique fallback slugs for invalid/duplicate existing events.
- Existing events are backfilled to the Boston chapter.
- Public RSVP/application/check-in UI remains disabled in Phase 1 even when metadata exists.

## New Entities

### Chapter

Local Sundai community and operational unit.

**Fields**

- `id`
- `name`
- `slug`
- `city`
- `region`
- `country`
- `timezone`
- `description`
- `status`
- `accessMode`
- `defaultDeclineMessage`
- `mailingListName`
- `mailingListExternalId`
- `createdAt`
- `updatedAt`

**Relationships**

- Has many `ChapterMembership`.
- Has many `Event`.
- Has one active chapter-scoped `ApplicationTemplate`.
- Has many `UserBanFlag`.

**Validation rules**

- `slug` is unique and URL-safe.
- Active public chapters are publicly listable.
- Private chapters are visible only to invited users, active members, chapter admins for the chapter, and site admins.
- A chapter must not be left without at least one active chapter admin once admins exist.

**States**

- `ACTIVE`
- `PAUSED`
- `ARCHIVED`

### ChapterMembership

Relationship between a hacker and a chapter.

**Fields**

- `id`
- `chapterId`
- `hackerId`
- `role`
- `status`
- `invitedById`
- `invitedAt`
- `joinedAt`
- `leftAt`
- `revokedAt`
- `notificationsAllowed`
- `emailNotificationsEnabled`
- `smsNotificationsEnabled`
- `notificationPreferencesJson`
- `createdAt`
- `updatedAt`

**Validation rules**

- Unique membership per `(chapterId, hackerId)`.
- Public chapter joins create or reactivate an `ACTIVE` member record.
- Private chapter acceptance requires an `INVITED` record.
- A member may update only their own notification preferences unless an admin is managing membership.

**States**

- `INVITED`
- `ACTIVE`
- `REVOKED`
- `LEFT`

### EventStaff

Event-scoped staff assignment replacing `EventMC`.

**Fields**

- `id`
- `eventId`
- `hackerId`
- `role`
- `createdAt`
- `updatedAt`

**Validation rules**

- Unique assignment per `(eventId, hackerId, role)`.
- Existing `EventMC` rows migrate to `EventStaff` with `role = MC`.
- MCs can manage assigned-event metadata, pitch, and registration review workflows when present.
- Co-MCs can manage pitch and operational resources but cannot approve, waitlist, or decline applicants.

**Roles**

- `MC`
- `CO_MC`

### ApplicationTemplate

Reusable site or chapter application field definition.

**Fields**

- `id`
- `scope`
- `chapterId`
- `name`
- `fieldsJson`
- `isActive`
- `createdById`
- `createdAt`
- `updatedAt`

**Validation rules**

- Exactly one active site template.
- At most one active chapter template per chapter.
- Default site template contains required `name` and `email` fields.
- Chapter/event configuration cannot remove site-required fields.
- Event-level configuration may hide chapter-default questions while preserving site-required fields.

### EventRegistration

Internal event application/RSVP foundation record.

**Fields**

- `id`
- `eventId`
- `hackerId`
- `status`
- `source`
- `answersJson`
- `templateSnapshotJson`
- `publicSafeMessage`
- `internalReviewNotes`
- `decidedById`
- `decidedAt`
- `createdAt`
- `updatedAt`

**Validation rules**

- Unique active registration per `(eventId, hackerId)`.
- Public registration submission is not exposed in Phase 1.
- Active global bans block later registration flows with only: "You are unable to register for this event at this time."
- Non-site-admin registration queries exclude globally banned users without exposing ban state.

**Statuses**

- `PENDING`
- `APPROVED`
- `WAITLISTED`
- `DECLINED`
- `BLOCKED`
- `CANCELLED`

`NO_SHOW` is intentionally not a Phase 1 registration status unless implementation confirms product wants registration-level no-show separate from future attendance.

### EventRegistrationAudit

Audit history for internal registration changes.

**Fields**

- `id`
- `registrationId`
- `eventId`
- `actorId`
- `fromStatus`
- `toStatus`
- `changeJson`
- `createdAt`

**Validation rules**

- Created for organizer/admin registration state changes.
- Public users do not read audit records in Phase 1.

### UserBan

Permanent global ban controlled by site admins.

**Fields**

- `id`
- `hackerId`
- `publicSafeReason`
- `internalNote`
- `createdById`
- `createdAt`
- `revokedById`
- `revokedAt`
- `revocationReason`

**Validation rules**

- Only site admins can create, view, or revoke.
- Active bans are global and permanent until revoked.
- Ban list counts/reasons are hidden from chapter admins, MCs, co-MCs, and regular users.

### UserBanFlag

Chapter-admin review request for possible global ban action.

**Fields**

- `id`
- `chapterId`
- `hackerId`
- `createdById`
- `reason`
- `status`
- `resolutionNote`
- `resolvedById`
- `resolvedAt`
- `createdAt`
- `updatedAt`

**Validation rules**

- Chapter admins can create flags only for authorized chapters.
- Flags do not ban the hacker.
- Site admins resolve flags from the global moderation surface.

**States**

- `OPEN`
- `REVIEWING`
- `RESOLVED_NO_ACTION`
- `RESOLVED_BANNED`
- `DISMISSED`

### HackerOrganizerNote

Current internal organizer note for one hacker.

**Fields**

- `id`
- `hackerId`
- `body`
- `updatedById`
- `createdAt`
- `updatedAt`

**Validation rules**

- One current note per hacker.
- Site admins can view all notes.
- Relevant chapter admins can view/edit current notes and view revisions.
- Assigned MCs/co-MCs can view/edit relevant current notes but cannot view revisions.
- Regular users never read notes.

### HackerOrganizerNoteRevision

Audit record for organizer note edits.

**Fields**

- `id`
- `noteId`
- `hackerId`
- `editedById`
- `patchText`
- `createdAt`

**Validation rules**

- Revision is created whenever the current note body changes.
- Revision visibility is limited to site admins and relevant chapter admins.

## Enums

- `Role`: `NOT_SET`, `NEWBIE`, `HACKER`, `SPONSOR`, `LEADER`, `SITE_ADMIN`
- `ChapterStatus`: `ACTIVE`, `PAUSED`, `ARCHIVED`
- `ChapterAccessMode`: `PUBLIC`, `PRIVATE`
- `ChapterRole`: `MEMBER`, `ADMIN`
- `ChapterMembershipStatus`: `INVITED`, `ACTIVE`, `REVOKED`, `LEFT`
- `EventStaffRole`: `MC`, `CO_MC`
- `EventStatus`: `DRAFT`, `PUBLISHED`, `PAUSED`, `ARCHIVED`
- `EventVisibility`: `PUBLIC`, `PRIVATE`, `UNLISTED`
- `EventProgramType`: internal program taxonomy values, implementation-defined
- `EventApplicationMode`: `NONE`, `INTERNAL`, `PUBLIC_LATER`
- `ApplicationTemplateScope`: `SITE`, `CHAPTER`
- `RegistrationStatus`: `PENDING`, `APPROVED`, `WAITLISTED`, `DECLINED`, `BLOCKED`, `CANCELLED`
- `RegistrationSource`: `INTERNAL`, `PUBLIC_LATER`, `IMPORT`
- `BanFlagStatus`: `OPEN`, `REVIEWING`, `RESOLVED_NO_ACTION`, `RESOLVED_BANNED`, `DISMISSED`
