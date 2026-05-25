# Event Management Redesign Phase 1 Plan

Date: 2026-05-25

## Sources

- GitHub issue #142: "Event management redesign phase 1: foundations"
- GitHub issue #147: "Event management redesign: parent tracking issue"
- `Journey map + pain points.xlsx`
- Current app structure in `src/app`, current Prisma schema, and existing pitch/event/check-in routes

Issue #16 is intentionally ignored. It is older context and should not drive this phase.

## Phase Goal

Phase 1 creates the foundation for replacing Partiful and supporting multi-chapter event operations without rebuilding every event UI yet.

The concrete outcome is:

- chapters exist as first-class records
- chapters can be public or private
- users can join multiple public chapters and accept invitations to private chapters
- chapter membership stores notification permission preferences for later notification delivery
- site admins and chapter admins are distinct
- MC and co-MC are event-scoped roles
- event records can carry the metadata later phases need
- application template infrastructure exists
- event registration records exist even before the full RSVP UI
- global bans exist and are enforced in registration queries
- organizer notes exist as internal hacker notes
- all event/admin permission checks move behind shared helpers
- existing pitch behavior keeps working after the permission cutover

This phase should remove the current pattern of scattered `role === "ADMIN"` checks for event-management surfaces.

## Problems This Phase Directly Addresses

From #142 and #147:

- current admin privilege is a single global `ADMIN` role
- there is no chapter model
- there is no chapter-scoped admin role
- MC roles are too narrow and do not distinguish MC from co-MC
- RSVP/application, ban, and template data models do not exist
- pitch routes and admin checks duplicate authorization logic

From the journey map:

- approval is centralized and opaque
- approval reviewers cannot reliably see hacker context, attendance, project history, or internal notes
- ban checks are manual and easy to miss
- repeated application questions create recurring hacker friction
- QR/check-in is split from event application data
- event materials, templates, and previous event designs are scattered
- the current event listing still depends on Google Calendar instead of Sundai event data
- there is no chapter landing page where hackers can see chapter events and formally associate themselves with a chapter
- there is no model for private invite-only chapters
- there is no chapter-level notification permission state for future chapter communications

Phase 1 does not fix every pain point end-to-end. It lays the database, permission, and admin primitives that make later fixes straightforward.

## Non-Goals

Do not build these in Phase 1:

- native public RSVP/application flow
- full public event-detail replacement
- email/SMS sending
- actual chapter notification delivery; Phase 1 only stores whether a chapter may notify a member and the member's channel preferences
- QR check-in scanner
- event-native attendance cutover
- organizer workspace for live event operations
- reporting, social drafts, newsletter drafts, sponsor reports
- Partiful historical import
- guest RSVP support
- public waitlist position
- temporary, chapter-specific, or event-specific bans
- automated rejection or ban decisions from organizer notes
- MC/co-MC assigned-event index; this can wait until the organizer workspace phase
- invite-only event behavior beyond schema support
- registration-record test coverage; these phases are internal progress scaffolding and registration behavior is not user-facing yet

## User Stories

### Site Admin

1. As a site admin, I can create, edit, pause, archive, and view chapters so Sundai can run events across multiple cities without hard-coded Boston assumptions.

2. As a site admin, I can assign and remove chapter admins so chapter operations are delegated without giving global site-admin powers.

3. As a site admin, I can see all chapters, events, templates, bans, and organizer notes needed for moderation and operations.

4. As a site admin, I can create and revoke permanent global bans so banned users are blocked from event registration flows without exposing the ban list to MCs.

5. As a site admin, I can manage the site-level application template so every chapter collects required fields consistently.

6. As a site admin, I can create or edit events in any chapter and assign MCs/co-MCs so the new permission model is usable before the RSVP UI lands.

7. As a site admin, I can inspect permission-sensitive behavior through tests and shared helpers rather than route-by-route special cases.

8. As a site admin, I can view chapter-admin ban flags and decide whether to create a global ban so moderation remains site-admin controlled.

### Chapter Admin

1. As a chapter admin, I can manage my chapter's event metadata so events can be owned locally.

2. As a chapter admin, I can publish chapter events immediately without waiting for site-admin approval.

3. As a chapter admin, I can manage the active chapter-level application question set so my chapter can ask local questions in addition to site-required fields.

4. As a chapter admin, I can assign MCs and co-MCs for events in my chapter so event operations are delegated to the right people.

5. As a chapter admin, I can view and edit organizer notes for hackers in my chapter workflows so review context is not lost.

6. As a chapter admin, I can view organizer-note edit history so sensitive notes remain auditable.

7. As a chapter admin, I cannot see or manage the global ban list unless I am also a site admin.

8. As a chapter admin, I can create and fully control events for my chapter without a site admin creating drafts for me.

9. As a chapter admin, I can make a chapter public or private so private chapters are only accessible to invited members.

10. As a chapter admin, I can invite hackers to a private chapter so they can access that chapter and its events.

11. As a chapter admin, I can flag a hacker for site-admin ban review without creating the ban myself.

### Event MC

1. As an MC, I can be assigned to a specific event so I have event-scoped operational access without global admin access.

2. As an MC, I can manage the existing pitch workflow for my assigned event.

3. As an MC, I can review registration records once the registration UI exists.

4. As an MC, I can approve, waitlist, and decline applicants in later phases because Phase 1 gives the system a permission helper and registration model for it.

5. As an MC, I can view and edit the current organizer note for relevant hackers so reviewer context is shared.

6. As an MC, I cannot see organizer-note revision history.

7. As an MC, I cannot see banned users in normal applicant queues and cannot inspect global ban records.

8. As an MC, I can edit event metadata for my assigned event.

9. As an MC, I can edit organizer notes for relevant hackers.

### Event Co-MC

1. As a co-MC, I can be assigned to a specific event so I can help with event operations without applicant-decision power.

2. As a co-MC, I can manage the existing pitch workflow for my assigned event.

3. As a co-MC, I can view and edit relevant organizer notes so I can help run the event with context.

4. As a co-MC, I cannot approve, waitlist, or decline applicants.

5. As a co-MC, I cannot see organizer-note revision history.

6. As a co-MC, I cannot see banned users in normal applicant queues and cannot inspect global ban records.

7. As a co-MC, I can edit event resources and materials for my assigned event.

8. As a co-MC, I can edit organizer notes for relevant hackers.

### Recurrent Hacker

1. As a recurrent hacker, my stable profile fields are stored on my Sundai account so future applications can be prefilled instead of asking the same questions every time.

2. As a recurrent hacker, my event applications are associated with my account so organizers can later see relevant attendance and project context during review.

3. As a recurrent hacker, I do not see organizer notes, ban data, or internal review notes.

4. As a recurrent hacker, I should not need to interact with any new Phase 1 UI unless I am also an organizer.

5. As a recurrent hacker, I can join more than one public chapter so my profile is associated with the local Sundai communities I participate in.

6. As a recurrent hacker, I can accept an invitation to a private chapter so I can access chapter information that is not public.

7. As a recurrent hacker, I can update chapter notification permissions so each chapter knows whether it may contact me later.

### New Hacker

1. As a new hacker, my account can hold required profile fields such as name and email so the later application flow can prefill and validate required data.

2. As a new hacker, my event registration can be represented natively in Sundai once RSVP UI is built.

3. As a new hacker, I should not see internal admin, MC, co-MC, note, or ban surfaces.

4. As a new hacker, I can join a public chapter from its chapter page.

5. As a new hacker, I cannot access a private chapter unless invited.

## Pages And Features In Phase 1

### Existing `/admin`

Current state: this page is a project moderation list gated by client-side `isAdmin`.

Phase 1 cutover:

- Convert `/admin` into a site-admin console landing page.
- Move the existing project moderation view to `/admin/projects`.
- Gate access through server-backed site-admin checks, not only client state.
- Add navigation to the Phase 1 admin surfaces below.

### New `/admin/projects`

Audience: site admins.

Features:

- preserve the current project moderation list and status filters
- keep this as the destination linked from the new `/admin` dashboard
- use the shared site-admin helper instead of direct `ADMIN` checks

### New `/admin/chapters`

Audience: site admins.

Features:

- list chapters
- create chapter
- edit chapter name, slug, city, region, country, timezone, description, status
- set chapter access mode to public or private
- pause/archive chapters
- show chapter admins for each chapter
- add/remove chapter admins by hacker lookup
- invite hackers to private chapters
- view active, invited, and revoked chapter memberships
- show Boston backfill record after migration

This page is needed in Phase 1 because chapter admin delegation is otherwise impossible to operate.

### New `/admin/application-templates`

Audience: site admins.

Features:

- view active site-level application template
- edit site-required fields
- require only name and email as the default site-level fields
- view chapter-level templates across chapters
- select a chapter and edit that chapter's active default questions
- preview merged site + chapter schema
- prevent removal of site-required fields from chapter templates

This page can use a structured JSON schema editor or a constrained form-builder. A constrained form-builder is safer for non-developer admins, but JSON can be acceptable for the first internal cutover if validation and preview are strong.

### New `/admin/bans`

Audience: site admins only.

Features:

- search hackers
- create permanent global ban
- store public-safe reason and internal note separately
- view active/revoked bans
- revoke a ban
- view chapter-admin ban flags and their resolution state
- show who created/revoked a ban and when
- never expose this page or its counts to chapter admins, MCs, or co-MCs

### New `/chapters`

Audience: public users, signed-in hackers, organizers.

Features:

- list active public chapters
- show city, timezone, and upcoming published events for public chapters
- hide private chapters unless the current user is an invited or active member, chapter admin, or site admin
- link to chapter landing pages

This is a lightweight directory, not a custom landing-page builder.

### New `/chapters/[chapterSlug]`

Audience: public users for public chapters; invited/active members and authorized organizers for private chapters.

Features:

- show chapter name, city, timezone, description, and upcoming chapter events
- show public events for public chapters
- require membership, invitation, chapter admin, or site admin access for private chapters
- show a `Join chapter` action for signed-in users on public chapters
- show `Accept invite` for invited users on private chapters
- show current membership state
- show chapter notification controls for active members
- allow users to leave a chapter if they are regular members and not the only chapter admin

Notification controls:

- store whether this chapter may send the member notifications later
- store channel preferences such as email enabled and SMS enabled
- do not send email or SMS in Phase 1
- do not require phone number in Phase 1

The chapter landing page is in scope because hackers need a place to discover chapter events and formally associate themselves with chapters before RSVP and notification phases can build on that relationship.

### New `/organizer/chapters/[chapterSlug]/settings`

Audience: site admins and chapter admins for the chapter.

Features:

- edit chapter metadata
- set public/private access mode
- manage chapter admins and regular members
- invite hackers to private chapters
- revoke or remove memberships
- view member notification permission state
- edit the active chapter-level application template
- edit the chapter default declined-user message
- view chapter-admin ban flags created for the chapter

This is the chapter-admin control surface. Site admins can also use `/admin/chapters`, but chapter admins need their own route because they have full control over their chapter without being global admins.

### New `/organizer/events`

Audience: site admins and chapter admins.

Features:

- list events the user can manage
- site admins see all events
- chapter admins see their chapter events
- MCs/co-MCs do not need this page in Phase 1
- show chapter, title, status, visibility, start time, program type, MCs/co-MCs
- link to event settings

This is intentionally an internal management index, not the public event listing replacement.

### New `/organizer/events/new`

Audience: site admins and chapter admins.

Features:

- create an event for an authorized chapter
- chapter field defaults to the chapter admin's chapter when only one chapter is available
- set title, slug, public description, public location summary, start/end time, timezone, capacity, visibility, application mode, program type, public program label, approved-only details, and pitch timing defaults
- assign MCs and co-MCs
- attach event-level custom application questions as JSON/schema
- save as draft or publish immediately

This page should create the event data later phases need, even though Phase 1 will not yet expose the public RSVP flow.

### New `/organizer/events/[eventId]/settings`

Audience: site admins, chapter admins for the event chapter, assigned MCs/co-MCs with limited access.

Features:

- edit event metadata
- edit pitch timing defaults
- manage MC/co-MC assignments if site admin or chapter admin
- view application template composition
- edit event-level custom questions if site admin or chapter admin
- show permission-relevant event state

Permission split:

- site admin: full edit
- chapter admin: full edit for own chapter
- MC: can edit assigned-event metadata and operational fields
- co-MC: can edit assigned-event resources/materials and operational fields, but no application decision settings

### Existing `/pitch` and `/pitch/[eventId]`

Current state: events and MCs already power pitch queue work through `Event`, `EventMC`, and direct admin/MC checks.

Phase 1 cutover:

- Replace `EventMC` usage with `EventStaff`.
- Support `MC` and `CO_MC` roles.
- Keep current pitch UX working.
- Allow site admins, chapter admins, MCs, and co-MCs to manage pitch controls through shared permission helpers.
- Do not rebuild pitch queue UI.

### Existing `/events`

Current state: Google Calendar embed.

Phase 1 behavior:

- Leave the public Google Calendar page largely unchanged unless a small internal link is needed.
- Do not replace public event discovery in Phase 1.
- Build enough event data so Phase 2 can replace this page with native event listings.

### No New Hacker-Facing RSVP Pages In Phase 1

The following routes should not be user-facing in Phase 1:

- `/events/[chapterSlug]/[eventSlug]`
- event application form
- approved-only event details
- user RSVP status page
- QR check-in page

They belong to Phase 2 and Phase 3.

## Data Model Cutover

### Role Rename

Cut over `Role.ADMIN` to `Role.SITE_ADMIN`.

Required changes:

- Prisma enum
- migrations
- seed data
- tests
- middleware
- `UserContext`
- API route checks
- project moderation checks
- event/pitch checks

Do not keep a long-term compatibility path for both `ADMIN` and `SITE_ADMIN`.

### Chapters

Add:

- `Chapter`
- `ChapterMembership`
- `ChapterRole`
- `ChapterAccessMode`
- `ChapterMembershipStatus`

Backfill:

- create Boston chapter with slug `boston`
- timezone `America/New_York`
- access mode `PUBLIC`
- attach all existing events to Boston

Chapter rules:

- chapters can be `PUBLIC` or `PRIVATE`
- public chapters are listed publicly and can be joined by signed-in users
- private chapters are hidden from non-members unless the user is invited, a chapter admin, or a site admin
- users can belong to multiple chapters
- chapter membership stores notification permission for future notification sending
- no notification provider integration is included in Phase 1

Suggested fields on `Chapter`:

- `accessMode ChapterAccessMode @default(PUBLIC)`
- `status ChapterStatus @default(ACTIVE)`
- `timezone String`
- `description String?`
- `defaultDeclineMessage String?`
- `mailingListName String?`
- `mailingListExternalId String?`

Suggested fields on `ChapterMembership`:

- `chapterId String`
- `hackerId String`
- `role ChapterRole`
- `status ChapterMembershipStatus @default(ACTIVE)`
- `invitedById String?`
- `joinedAt DateTime?`
- `notificationsAllowed Boolean @default(true)`
- `emailNotificationsEnabled Boolean @default(true)`
- `smsNotificationsEnabled Boolean @default(false)`
- `notificationPreferencesJson Json?`

Indexes and constraints:

- unique membership record per `[chapterId, hackerId]`; rejoin/reactivation updates status instead of creating duplicates
- index memberships by `hackerId`
- index invited memberships by `chapterId` and `status`

Enums:

- `ChapterAccessMode.PUBLIC`
- `ChapterAccessMode.PRIVATE`
- `ChapterRole.MEMBER`
- `ChapterRole.ADMIN`
- `ChapterMembershipStatus.INVITED`
- `ChapterMembershipStatus.ACTIVE`
- `ChapterMembershipStatus.REVOKED`
- `ChapterMembershipStatus.LEFT`

### Event Staff

Replace:

- `EventMC`

With:

- `EventStaff`
- `EventStaffRole.MC`
- `EventStaffRole.CO_MC`

Backfill:

- every existing `EventMC` row becomes `EventStaff(role = MC)`

### Event Fields

Add fields needed by later phases:

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
- `applicationsOpen`
- `applicationsCloseReason`
- `checkInOpensAt`
- `checkInClosesAt`

Keep the existing pitch fields on `Event`.

Important naming recommendation:

- Keep `location` only if it is explicitly the public location summary.
- Prefer a cutover to `publicLocation` plus `address` to avoid accidentally exposing exact address.

### Application Templates

Add:

- `ApplicationTemplate`
- `ApplicationTemplateScope.SITE`
- `ApplicationTemplateScope.CHAPTER`

Rules:

- one active site template
- one active chapter template per chapter
- event-specific questions live on `Event.applicationQuestionsJson` for this phase
- default site-level fields are only name and email
- phone number is not required in Phase 1
- chapter admins can edit their chapter default template and extend the site template
- event-level configuration can hide chapter-default questions
- event-level configuration cannot hide site-required questions
- store schema snapshots on future registrations

### Registrations

Add:

- `EventRegistration`
- `RegistrationStatus`
- `RegistrationSource`
- `EventRegistrationAudit`

Phase 1 API can create and query records for internal/admin use, but public RSVP UI waits for Phase 2.

Statuses:

- `PENDING`
- `APPROVED`
- `WAITLISTED`
- `DECLINED`
- `BLOCKED`
- `CANCELLED`
- `NO_SHOW`

### Organizer Notes

Add:

- `HackerOrganizerNote`
- `HackerOrganizerNoteRevision`

Rules:

- one current note body per hacker
- revisions stored as text patches
- site admins can see all notes and revisions
- chapter admins can see relevant notes and revisions
- MC/co-MC can see and edit relevant current note body
- users never see notes

### Global Bans

Add:

- `UserBan`
- `UserBanFlag`

Rules:

- only site admins can create/revoke
- global only
- permanent until revoked
- hidden from MC/co-MC/chapter admin queues
- no signal in normal chapter workflows
- banned users who try to register later see only: "You are unable to register for this event at this time."
- chapter admins can flag users for site-admin ban review
- chapter-admin ban flags have a log similar to organizer notes
- site admins maintain the ban list and resolve ban flags

## Permission Helpers

Create shared server-side helpers before route/page rewrites:

- `getCurrentHacker()`
- `requireCurrentHacker()`
- `isSiteAdmin(hacker)`
- `requireSiteAdmin(hacker)`
- `isChapterAdmin(hackerId, chapterId)`
- `getChapterMembership(hackerId, chapterId)`
- `canViewChapter(hacker, chapter)`
- `canJoinChapter(hacker, chapter)`
- `canManageChapterNotifications(hacker, chapterId)`
- `getEventStaffRole(hackerId, eventId)`
- `canManageChapter(hacker, chapterId)`
- `canManageEvent(hacker, event)`
- `canManageEventSettings(hacker, event)`
- `canReviewEventRegistrations(hacker, event)`
- `canManagePitch(hacker, event)`
- `canViewOrganizerNotes(hacker, eventOrChapterContext)`
- `canViewOrganizerNoteRevisions(hacker, eventOrChapterContext)`
- `canManageGlobalBans(hacker)`
- `canFlagUserForBanReview(hacker, chapterId)`

Permission rules:

- site admin can manage everything
- chapter admin can create and fully manage own chapter events, chapter members, chapter invites, and chapter template
- public chapters are visible to everyone and joinable by signed-in users
- private chapters are visible only to active members, invited users, chapter admins, and site admins
- chapter members can edit their own chapter notification preferences
- MC can manage assigned-event metadata, pitch, and review registrations
- co-MC can manage assigned-event resources/materials, pitch, and operations, but cannot approve/waitlist/decline
- global ban management is site-admin only
- chapter admins can flag users for ban review, but cannot create bans
- organizer-note revision history is site-admin/chapter-admin only

## API Scope

### Chapters

- `GET /api/chapters`
- `POST /api/chapters`
- `GET /api/chapters/[chapterId]`
- `PATCH /api/chapters/[chapterId]`
- `POST /api/chapters/[chapterId]/admins`
- `DELETE /api/chapters/[chapterId]/admins/[hackerId]`
- `GET /api/chapters/[chapterId]/members`
- `POST /api/chapters/[chapterId]/members`
- `PATCH /api/chapters/[chapterId]/members/[hackerId]`
- `POST /api/chapters/[chapterId]/join`
- `POST /api/chapters/[chapterId]/leave`
- `POST /api/chapters/[chapterId]/invites`
- `POST /api/chapters/[chapterId]/invites/accept`
- `PATCH /api/chapters/[chapterId]/notifications`

### Application Templates

- `GET /api/application-templates`
- `POST /api/application-templates`
- `PATCH /api/application-templates/[templateId]`
- `GET /api/application-templates/merged?chapterId=...&eventId=...`

### Bans

- `GET /api/admin/bans`
- `POST /api/admin/bans`
- `PATCH /api/admin/bans/[banId]`
- `GET /api/admin/ban-flags`
- `PATCH /api/admin/ban-flags/[flagId]`

Use `PATCH` for revoke so the ban record remains auditable.

Chapter-admin ban flag route:

- `POST /api/chapters/[chapterId]/ban-flags`

This route creates a site-admin review item. It does not ban the user and does not expose the global ban list to chapter admins.

### Organizer Notes

- `GET /api/hackers/[hackerId]/organizer-note`
- `PUT /api/hackers/[hackerId]/organizer-note`
- `GET /api/hackers/[hackerId]/organizer-note/revisions`

### Events

Update existing:

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/[eventId]`
- `PATCH /api/events/[eventId]`

Add:

- `POST /api/events/[eventId]/publish`
- `POST /api/events/[eventId]/staff`
- `DELETE /api/events/[eventId]/staff/[staffId]`

### Registrations

Minimal foundation routes:

- `GET /api/events/[eventId]/registrations`
- `POST /api/events/[eventId]/registrations`
- `PATCH /api/events/[eventId]/registrations/[registrationId]`

Phase 1 can keep these behind organizer/admin permissions or internal tests. Public submission behavior belongs to Phase 2.

Do not spend Phase 1 effort on registration-record tests. Registration tables exist so later phases have a target shape, but the registration behavior is not user-facing yet.

## Implementation Order

1. Add permission helper module and tests around current `ADMIN` behavior.
2. Rename `Role.ADMIN` to `Role.SITE_ADMIN` and update all references.
3. Add chapter schema, public/private access mode, and Boston backfill migration.
4. Add chapter membership, invitation status, notification preference fields, helpers, and admin assignment API.
5. Build `/chapters`, `/chapters/[chapterSlug]`, and `/organizer/chapters/[chapterSlug]/settings` with join, invite acceptance, member management, chapter template editing, and notification preference controls.
6. Replace `EventMC` with `EventStaff`, migrate rows, and update pitch/event routes.
7. Add event metadata fields and route validation.
8. Add application template schema, merge helper, API, and admin page.
9. Add registration and registration audit schema as internal foundation only.
10. Add global ban schema, chapter-admin ban flag schema, ban APIs, and ban admin page.
11. Add organizer notes schema, text-patch diff utility, note API, and visibility tests.
12. Build `/admin` console landing, move project moderation to `/admin/projects`, and build `/admin/chapters`.
13. Build `/organizer/events`, `/organizer/events/new`, and `/organizer/events/[eventId]/settings`.
14. Update tests for route and UI permission behavior, excluding registration-record behavior.

## Testing Scope

Required tests:

- site admin can create/update chapters
- non-site-admin cannot create chapters
- site admin can assign/remove chapter admins
- public chapter appears in `/chapters`
- private chapter is hidden from unauthorized users
- signed-in user can join a public chapter
- invited user can access and accept a private chapter invite
- chapter member can update chapter notification preferences
- chapter admin can manage own chapter events
- chapter admin cannot manage another chapter's events
- chapter admin can create an event for own chapter
- existing pitch controls still work for site admin
- existing pitch controls still work for MC
- co-MC can manage pitch controls
- MC can edit assigned-event metadata
- co-MC can edit assigned-event resources/materials
- only site admins can create/revoke global bans
- chapter admins can create ban flags but cannot create bans
- normal chapter workflows expose no signal that a hidden user is globally banned
- application template merge order is site, chapter, event
- site-required fields are name and email by default
- site-required fields cannot be removed by chapter/event templates
- event-level configuration can hide chapter-default questions
- chapter admin can edit chapter default declined-user message
- organizer-note body is visible to authorized organizers
- organizer-note body is editable by MC/co-MC
- organizer-note revisions are visible only to site/chapter admins
- organizer-note revisions are stored as text patches
- users cannot read organizer notes
- `Role.ADMIN` references are gone after cutover

Not required in Phase 1:

- registration-record behavior tests
- notification delivery tests
- invite-only event behavior tests

## Settled Decisions From Team Feedback

These decisions answer the previous open questions and should not be re-opened during Phase 1 implementation unless product requirements change.

1. Chapter admins can create new events and have full control over their chapter. They do not need a site admin to create drafts for them.

2. MCs can edit event metadata for assigned events.

3. Co-MCs can edit event resources and materials for assigned events.

4. The default site-required application template is only name and email.

5. Phone number is not required in Phase 1. SMS is not configured in this phase, so requiring phone would add friction before the system uses it.

6. Banned users should see a generic pop-up: "You are unable to register for this event at this time."

7. Decline message text is configurable by the chapter. Internal reasons and organizer notes are never exposed.

8. Normal chapter workflows should show no signal when a globally banned user is hidden or blocked.

9. The organizer hacker context panel should show all relevant context: profile fields, attendance count, last attendance, shipped projects, pitch history, application answers, registration history, and organizer notes.

10. Organizer notes are editable by MCs and co-MCs.

11. Organizer-note revisions use text patches.

12. Event `programType` is private/internal metadata for now.

13. Chapter admins can edit their chapter templates and extend the site-admin template.

14. Event-level configuration can hide chapter-default questions but cannot hide site-level required questions.

15. Registration records are internal progress scaffolding in Phase 1. We do not need user-facing registration flows or registration-record behavior tests yet.

16. If existing events have duplicate or invalid slugs during backfill, generate a sane default slug with a number. Add a text flag at the start of the event title or migration note using `[FLAG]` so the team can find and clean it later.

17. Move project moderation to `/admin/projects`; `/admin` becomes the general admin dashboard.

18. Do not make `/organizer/events` visible to MCs/co-MCs in Phase 1. They do not need an assigned-events index until later organizer workspace work.

19. Invite-only events are schema-only for now.

20. Chapter admins can flag users for site-admin ban review. Site admins are the only users who actually create, revoke, and maintain global bans. Ban flags need a log similar to organizer notes.

## Explicitly Not Doing Yet

- Do not send chapter notifications. Phase 1 only stores notification permission and channel preferences because providers and content flows are later work.
- Do not require phone numbers. Name and email are enough for the site-required template at this point.
- Do not expose private chapters to non-members. Private chapter access requires active membership, invitation, chapter admin, or site admin access.
- Do not let chapter admins create global bans. They can flag users for review, but site admins own the ban list.
- Do not expose ban-list signals in normal chapter workflows. This prevents accidental disclosure to chapter admins, MCs, co-MCs, or users.
- Do not build user-facing RSVP/application pages. Event registration records exist so later phases have schema targets.
- Do not test registration-record behavior in Phase 1. It is not exposed to users yet.
- Do not build notification delivery tests. There is no delivery implementation in this phase.
- Do not make invite-only event behavior functional yet. The enum/state may exist for future work, but the UX is not part of this phase.
- Do not build an MC/co-MC organizer event index. Their direct operational surfaces can come with the organizer workspace phase.

## Issues And Recommendations

### 1. The Existing `/admin` Page Is Too Narrow

The current `/admin` page is a project list, not an admin console. Phase 1 needs multiple admin tools, so keeping everything under one page will get messy quickly.

Recommendation: make `/admin` a console and move the current project moderation list to `/admin/projects`.

### 2. Public And Private Location Fields Need A Hard Split

The current event schema has `location` and `meetingUrl`. The journey map calls out sensitive resources/toolkits and #147 calls out exact event details hidden until approval.

Recommendation: use `publicLocation`, `address`, `virtualUrl`, and `approvedDetailsJson`. Avoid a single ambiguous `location` field.

### 3. Application Templates Should Be Structured, Not Arbitrary Markdown

Templates will drive validation, prefill, and future reporting. Arbitrary text will create the same manual ambiguity the redesign is trying to remove.

Recommendation: store template fields as JSON schema-like objects with stable field IDs, labels, types, required flags, and profile-field bindings.

### 4. Ban Filtering Must Live Below The UI

If ban filtering is implemented only in React pages, API consumers can still leak banned applicants to MCs.

Recommendation: registration query helpers should exclude active bans by default for non-site-admin organizer views.

### 5. Organizer Notes Are Sensitive Enough To Need Tight Boundaries

Shared notes are useful, but they can also become high-risk free text.

Recommendation: keep them internal, audited, and never exposed in exports, sponsor reports, public pages, email templates, or user-facing declined messages.

### 6. `NO_SHOW` May Belong To Attendance, Not Registration

Issue #142 includes `NO_SHOW` in `RegistrationStatus`, while Phase 3 introduces `EventAttendanceStatus.NO_SHOW`. Having no-show in both places may duplicate state.

Recommendation: keep `NO_SHOW` out of registration if possible and derive it from event attendance after check-in cutover. If product wants registration-level no-show history, document which model is canonical.

### 7. Chapter Admin Visibility Into Notes Needs A Precise Definition

#142 says chapter admins can see notes for applicants/users in their chapter workflows. That is not the same as seeing every note for every hacker who has ever attended the chapter.

Recommendation: in Phase 1, define "relevant" as a hacker with a registration, staff assignment, project entry, or organizer workflow relation to a chapter event. Avoid unrestricted note browsing for chapter admins.

### 8. Event Program Types Should Stay Internal By Default

The spreadsheet's hack taxonomy is useful for planning and reporting, but public labels may be too rigid or confusing.

Recommendation: store `programType` as internal metadata and use optional `publicProgramLabel` for public copy.

### 9. Existing Week Attendance Will Conflict With Event Attendance Later

Phase 1 does not cut over attendance, but current `/api/attendance` auto-creates `Week` records and `/api/projects` also auto-attaches projects to weeks.

Recommendation: do not touch attendance in Phase 1 beyond documenting the risk. Phase 3 should explicitly stop new event flows from creating week records.

## Definition Of Done

Phase 1 is complete when:

- Boston chapter exists and current events are attached to it
- `ADMIN` has been cut over to `SITE_ADMIN`
- chapter admins can be assigned
- chapters can be public or private
- `/chapters` and `/chapters/[chapterSlug]` exist
- `/organizer/chapters/[chapterSlug]/settings` exists for chapter admins
- signed-in users can join public chapters
- invited users can access and join private chapters
- users can belong to multiple chapters
- chapter membership stores notification permission and channel preferences
- existing pitch event creation and pitch controls still work
- event staff supports MC and co-MC
- event metadata supports Phase 2 RSVP/event pages
- site/chapter/event template data exists and can be merged
- default site-level required template fields are name and email
- chapter default declined-user message can be stored
- event registration and audit records exist
- global bans can be created/revoked by site admins
- chapter admins can flag users for site-admin ban review
- banned users are excluded from non-site-admin registration queries
- organizer notes and revision audit exist with correct visibility
- organizer-note revisions use text patches
- admin/organizer pages provide enough internal tooling to operate the foundation
- `/admin` is a general dashboard and project moderation is under `/admin/projects`
- direct route-level permission checks use shared helpers
- tests cover the core permission matrix and migration-sensitive behavior
