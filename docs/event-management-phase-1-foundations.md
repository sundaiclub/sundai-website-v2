# Phase 1: Foundations

## Purpose

Create the chapter, permission, template, registration, notes, and global ban foundations that the rest of the event-management system will use. This phase should not try to redesign every event UI. It should make the database and authorization model correct enough that later phases do not keep patching around global `ADMIN` checks.

## Current Codebase Starting Point

- `Hacker.role` is a single global enum with `ADMIN` as the privileged role.
- Existing admin checks are scattered as direct `role === "ADMIN"` checks.
- `Event`, `EventMC`, `EventProject`, pitch voting, queue control, and pitch phase transitions already exist.
- There is no chapter model.
- There is no native RSVP/application model.
- There is no ban model.
- There is no event application template model.
- Attendance is tied to `Week`, not `Event`.

## Settled Decisions For This Phase

- The default backfilled chapter is `Boston`.
- Chapter admins can publish events immediately.
- Site admins can create chapters and assign chapter admins.
- Chapter admins manage their own chapter events.
- MC and co-MC are event-scoped roles.
- MCs can approve, waitlist, and reject applicants.
- Co-MCs can manage event operations but cannot approve, waitlist, or reject applicants.
- The ban list is global-only for now.
- Only site admins can add permanent global bans.
- Banned users should be hidden from MC and co-MC review queues.
- MC notes are global to a hacker, internal, and visible to site admins, chapter admins, event MCs, and event co-MCs.
- MC notes behave like one shared notepad per hacker. Organizers can edit the current note body, and the system keeps an edit log.
- The MC-note edit log is visible only to chapter admins and site admins.
- MC-note revisions should be stored as diffs.
- Application templates exist at three layers: site-level required fields, chapter-level default questions, and event-level custom questions.
- Chapter-level templates are one active chapter default question set, not many reusable named chapter templates.
- Site-required application fields should include phone number because SMS is planned.

## Data Model Scope

### Chapters

Add a first-class `Chapter` model:

```prisma
model Chapter {
  id          String @id @default(uuid())
  slug        String @unique
  name        String
  city        String
  region      String?
  country     String @default("US")
  timezone    String
  description String?
  status      ChapterStatus @default(ACTIVE)
  mailingListName String?
  mailingListExternalId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum ChapterStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}
```

Backfill:

- Create one chapter with `name = "Boston"`, `slug = "boston"`, likely `timezone = "America/New_York"`.
- Attach all existing events to Boston.
- Use Boston as the default chapter for existing projects only if a `homeChapterId` is introduced.

### Chapter Admins

Add chapter-scoped admin membership:

```prisma
model ChapterMembership {
  id        String @id @default(uuid())
  chapterId String
  hackerId  String
  role      ChapterRole
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([chapterId, hackerId])
  @@index([hackerId])
}

enum ChapterRole {
  ADMIN
}
```

Keep this intentionally narrow. Do not add chapter-local MCs here; MC and co-MC are event assignments.

### Site Admin Role

Rename or semantically treat current `ADMIN` as `SITE_ADMIN`.

Implementation options:

- Cutover enum from `ADMIN` to `SITE_ADMIN`.
- Or keep `ADMIN` in the database but use helper functions named `isSiteAdmin`.

The cleaner cutover is to change the enum, but it affects tests, seeds, webhook defaults, UI conditionals, and API routes. Since the user explicitly prefers cutovers over legacy paths, prefer the enum rename during implementation.

### Event Controllers

Extend `EventMC` into a more general event role assignment:

```prisma
model EventStaff {
  id       String @id @default(uuid())
  eventId  String
  hackerId String
  role     EventStaffRole
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([eventId, hackerId, role])
  @@index([hackerId])
}

enum EventStaffRole {
  MC
  CO_MC
}
```

Cutover choice:

- Replace `EventMC` with `EventStaff`.
- Migrate existing `EventMC` rows into `EventStaff(role = MC)`.
- Update pitch route checks to use event staff plus site/chapter admin permissions.

Permission meaning:

- `MC`: event details, resources, communications, check-in, pitch controls, application approve/waitlist/reject, MC notes.
- `CO_MC`: event details, resources, communications, check-in, pitch controls, MC notes, no application approve/waitlist/reject.

### Event Core Fields

Extend current `Event`:

```prisma
chapterId     String
slug          String
status        EventStatus @default(DRAFT)
visibility    EventVisibility @default(PUBLIC)
programType   EventProgramType?
capacity      Int?
applicationMode EventApplicationMode @default(REQUIRES_APPROVAL)
autoPromoteWaitlist Boolean @default(false)
endTime       DateTime?
venueName     String?
address       String?
virtualUrl    String?
approvedDetailsJson Json?
checkInOpensAt DateTime?
checkInClosesAt DateTime?
```

Suggested enums:

```prisma
enum EventStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  FINISHED
  ARCHIVED
}

enum EventVisibility {
  PUBLIC
  UNLISTED
}

enum EventApplicationMode {
  OPEN_RSVP
  REQUIRES_APPROVAL
  INVITE_ONLY
}
```

No `PENDING_APPROVAL` status is needed because chapter admins can publish immediately.

### Program Types

The spreadsheet includes a hack taxonomy. Store that taxonomy as event metadata:

```prisma
enum EventProgramType {
  PLATFORM_TESTING
  THEMATIC_SOLUTION
  TOOL_SPECIFIC
  RESEARCH_TRANSLATION
  EXPERT_CENTERED
  END_USER_CENTERED
  AI_LITERACY_TRAINING
  GROWTH_VENTURE
}
```

Clarification for open question 19: "Which program types are public?" means whether an event page should visibly label an event as, for example, `AI Research & Translational Hack`, or whether `programType` is internal planning metadata used only to choose templates, RSVP questions, and reporting structure.

Recommendation:

- Keep `programType` internal by default.
- Add `publicProgramLabel` as optional event wording if organizers want to show it.

### Application Templates

Use layered templates:

- Site-level template: required across all chapters.
- Chapter-level template: default additions for that chapter.
- Event-level custom questions: additions or overrides for one event.
- Only one chapter-level default question set is active per chapter.

```prisma
model ApplicationTemplate {
  id          String @id @default(uuid())
  scope       ApplicationTemplateScope
  chapterId   String?
  name        String
  version     Int @default(1)
  isActive    Boolean @default(true)
  schemaJson  Json
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum ApplicationTemplateScope {
  SITE
  CHAPTER
}
```

Event-level custom questions can live on `Event.applicationQuestionsJson` or a separate `EventApplicationQuestion` table. Prefer JSON schema first unless reporting needs per-question SQL queries immediately.

Template merge order:

1. Active site template required fields.
2. Active chapter template fields.
3. Event custom questions.

Rules:

- Site-required fields cannot be removed by chapters.
- Chapter defaults can be removed or hidden per event only if chapter admins are allowed to do so.
- Store the rendered schema/version on each submitted application so future template edits do not rewrite historical answers.

### Registrations

Add native applications/RSVPs:

```prisma
model EventRegistration {
  id             String @id @default(uuid())
  eventId        String
  hackerId       String
  status         RegistrationStatus @default(PENDING)
  source         RegistrationSource @default(WEBSITE)
  applicationJson Json?
  applicationSchemaSnapshotJson Json?
  reviewedById   String?
  reviewedAt     DateTime?
  reviewNote     String?
  checkedInAt    DateTime?
  checkInCode    String? @unique
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([eventId, hackerId])
  @@index([hackerId])
  @@index([eventId, status])
}

enum RegistrationStatus {
  PENDING
  APPROVED
  WAITLISTED
  DECLINED
  BLOCKED
  CANCELLED
  NO_SHOW
}
```

`BLOCKED` is the internal status for users caught by the site-admin-managed global ban list. It should be hidden from MC/co-MC queues and should not expose ban-list details to the user.

Do not add guest registration fields. Guests are explicitly out of scope.

### Registration Audit

Create an audit trail for status transitions:

```prisma
model EventRegistrationAudit {
  id             String @id @default(uuid())
  registrationId String
  actorId        String?
  fromStatus     RegistrationStatus?
  toStatus       RegistrationStatus
  note           String?
  createdAt      DateTime @default(now())
}
```

This is useful for transparency between organizers, even though users should not see internal notes.

### MC Notes

Add user notes that are visible to organizers but hidden from users:

```prisma
model HackerOrganizerNote {
  id          String @id @default(uuid())
  hackerId    String
  body        String
  updatedById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([hackerId])
  @@index([hackerId])
}

model HackerOrganizerNoteRevision {
  id         String @id @default(uuid())
  noteId     String
  editorId   String
  diff       String
  createdAt  DateTime @default(now())

  @@index([noteId])
  @@index([editorId])
}
```

Use these for operational context and review notes. Do not automate rejection or bans from these notes.

Visibility:

- Site admins: all notes.
- Chapter admins: notes shown for applicants/users in their chapter workflows.
- MC/co-MC: note body shown while reviewing or operating assigned events.
- Edit log: site admins and chapter admins only.
- Users: never.

### Global Bans

Use a global permanent ban model:

```prisma
model UserBan {
  id          String @id @default(uuid())
  hackerId    String
  reason      String?
  internalNote String?
  createdById String
  createdAt   DateTime @default(now())
  revokedAt   DateTime?
  revokedById String?

  @@index([hackerId])
}
```

Behavior:

- Only site admins can create bans.
- Ban list is not shown to MCs or co-MCs.
- Banned users should not appear in MC/co-MC applicant queues.
- If a banned user tries to RSVP, the system should create or update an internal `BLOCKED` registration or otherwise default-reject the request without showing the user to MC/co-MC review queues.
- Site admins can see and manage banned applicants and ban records.

## Permission Helpers To Build First

Create shared server-side helpers before touching pages:

- `getCurrentHacker()`
- `isSiteAdmin(hacker)`
- `isChapterAdmin(hackerId, chapterId)`
- `getEventStaffRole(hackerId, eventId)`
- `canManageEvent(hacker, event)`
- `canReviewEventRegistrations(hacker, event)`
- `canManagePitch(event, hacker)`
- `canViewOrganizerNotes(hacker, event)`
- `canManageGlobalBans(hacker)`

Important distinctions:

- `canManageEvent`: site admin, chapter admin, MC, co-MC.
- `canReviewEventRegistrations`: site admin, chapter admin, MC only.
- `canManagePitch`: site admin, chapter admin, MC, co-MC.
- `canManageGlobalBans`: site admin only.

## Route Changes In This Phase

Create minimal API primitives:

- `GET /api/chapters`
- `POST /api/chapters`
- `PATCH /api/chapters/[chapterId]`
- `POST /api/chapters/[chapterId]/admins`
- `DELETE /api/chapters/[chapterId]/admins/[hackerId]`
- `GET /api/application-templates`
- `POST /api/application-templates`
- `PATCH /api/application-templates/[templateId]`
- `POST /api/admin/bans`
- `DELETE /api/admin/bans/[banId]` or `PATCH` to revoke

Do not build the full RSVP UI in Phase 1. The goal is to have the foundation ready for Phase 2.

## Migration Plan

1. Add new schema.
2. Create Boston chapter.
3. Backfill existing events into Boston.
4. Migrate existing `EventMC` to `EventStaff(role = MC)`.
5. Rename `ADMIN` to `SITE_ADMIN` if taking the full cutover.
6. Update tests and seed data.
7. Replace event-route authorization with helpers.

## Tests

Add focused API/helper tests:

- Site admin can create chapters.
- Non-site-admin cannot create chapters.
- Chapter admin can manage own chapter events after event fields exist.
- MC can review registrations, co-MC cannot.
- Co-MC can manage pitch controls.
- Banned users are filtered out of MC/co-MC registration queries.
- Only site admins can create/revoke bans.
- Application template merge order is site, chapter, event.

## Not Happening In This Phase

- Public event browsing replacement.
- RSVP/application UI.
- Email/SMS sending.
- Check-in.
- Attendance cutover.
- Reporting outputs.
- Historical Partiful import.
- Temporary, chapter, or event bans.
- Guest support.

## Remaining Questions

1. What exact public message text should a globally blocked user see after the system default-rejects/blocks the RSVP?
