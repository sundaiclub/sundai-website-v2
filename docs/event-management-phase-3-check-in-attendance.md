# Phase 3: Check-In and Attendance Cutover

## Purpose

Replace the current week-based attendance model and external QR/check-in workflow with event-native check-in. This phase fixes the current manual CSV/QR/email process and makes attendance reliable for chapter, event, project, and post-hack reporting.

## Settled Decisions For This Phase

- Attendance should be tied to `Event`, not `Week`, for new event management.
- Approved users get access to check-in details.
- Exact location/resources can remain hidden until approval.
- No guests.
- Users can cancel before the event.
- Waitlist auto-promotion can be off or on by event, default off.
- Partiful history is not imported.
- Self check-in is allowed and will probably be the operating default.
- Self check-in requires scanning an event QR code at the event.

## Current Codebase Starting Point

- `Attendance` currently points to `Week`.
- `/attendance` checks users into the current week.
- `/api/attendance` auto-creates a `Week` if none exists.
- `/api/projects` also auto-creates weeks for projects.
- Pain point: someone sends participant CSVs manually, QR codes are generated outside the site, and check-in is not consistently enforced.

## Data Model Scope

Add event-native attendance:

```prisma
model EventAttendance {
  id             String @id @default(uuid())
  eventId        String
  hackerId       String
  registrationId String?
  status         EventAttendanceStatus @default(PRESENT)
  checkedInAt    DateTime @default(now())
  checkedInById  String?
  method         CheckInMethod
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([eventId, hackerId])
  @@index([hackerId])
  @@index([eventId, status])
}

enum EventAttendanceStatus {
  PRESENT
  LATE
  NO_SHOW
}

enum CheckInMethod {
  QR_SCAN
  MANUAL_LOOKUP
  SELF_CHECK_IN
  IMPORT
}
```

Registration already has:

```prisma
checkedInAt DateTime?
checkInCode String? @unique
```

Use both:

- `EventRegistration.checkedInAt` is quick status for registration views.
- `EventAttendance` is the durable attendance record.

## Check-In Codes

Generate `checkInCode` when a registration becomes approved.

Code requirements:

- Unique, unguessable, and revocable by regenerating.
- Encoded in a QR link to a route like `/events/[chapterSlug]/[eventSlug]/check-in?code=...`.
- Associated with a signed-in user where possible.
- Valid only for that event.

Do not rely only on email attachments. The approved user's event page should show their QR/check-in code.

## Approved User Experience

Approved users see:

- event approval state
- approved-only event details
- check-in QR/code
- calendar link
- cancellation action if still allowed

If not approved:

- pending users do not see QR
- waitlisted users do not see QR
- declined users do not see QR
- cancelled users do not see QR

## Door Staff Experience

Create a check-in screen for site admins, chapter admins, MCs, and co-MCs.

Capabilities:

- scan QR code
- manual search by name/email
- show approved list
- mark checked in
- show already-checked-in state
- show not-approved state
- optionally show waitlisted state
- add MC note if needed

Co-MCs can check users in. This fits their event-operations role and does not involve approval/rejection.

## Check-In Authorization

Allowed to check in attendees:

- site admin
- chapter admin for the event chapter
- event MC
- event co-MC

Self-check-in:

- Allowed. Only approved users can self-check in during the allowed check-in window after scanning the event QR code on-site.
- This will probably be the operating default.
- Organizer scan/manual lookup should still exist as a backup path.

Recommendation:

- Build event-QR self check-in and organizer scan/manual lookup. Default events to self check-in unless the deeper check-in workflow review changes that.

## No-Show Handling

After event end:

- Approved users with no `EventAttendance` can be marked `NO_SHOW`.
- This can be a manual action or a scheduled/admin action.
- No-show history can inform future review, but do not automate rejections in this cutover.

## Attendance Counter Cutover

Current fields:

- `Hacker.attended`
- `Hacker.totalMinutesAttended`
- `Hacker.lastAttendance`

Recommended behavior:

- Update `lastAttendance` on check-in.
- Recompute or increment `attended` from `EventAttendance`.
- Decide whether `totalMinutesAttended` still matters. If it does, calculate from event duration or check-in/out once check-out exists.

Avoid continuing to increment attendance from week check-in after this cutover.

## Week Model Cutover

For new event management:

- Stop creating `Week` records in `/api/attendance`.
- Stop using current week as the primary attendance bucket.
- Stop auto-attaching new projects to weeks during event flows.

Options for legacy pages:

- Keep `/weeks` as read-only legacy history until removed.
- Or convert weekly views into derived reporting grouped by event date.

Recommendation:

- Preserve old week data temporarily if needed.
- Do not create new week data from new event flows.

## API Scope

New or changed routes:

- `POST /api/events/[eventId]/registrations/[registrationId]/check-in`
- `POST /api/events/[eventId]/check-in`
- `GET /api/events/[eventId]/attendance`
- `PATCH /api/events/[eventId]/attendance/[attendanceId]`
- `POST /api/events/[eventId]/attendance/mark-no-shows`

Retire or redirect:

- `/api/attendance` week check-in
- `/attendance` page

The old routes can return a migration message or redirect to the active event check-in page once the cutover is complete.

## UI Scope

Build:

- approved user QR block on event detail page
- organizer check-in page/tab
- manual lookup
- checked-in list
- no-show list after event

Do not build:

- guest check-in
- check-out
- badge printing
- historical Partiful import

## Tests

Add tests for:

- approved registration gets check-in code.
- pending/waitlisted/declined users cannot check in.
- MC and co-MC can check in approved users.
- co-MC still cannot approve applicants.
- duplicate check-in is idempotent or returns already checked in.
- manual lookup respects event permissions.
- user attendance counters update.
- old week attendance is not used by new event check-in.

## Not Happening In This Phase

- Guest check-in.
- Partiful historical attendance import.
- Temporary ban handling.
- Automated no-show penalties.
- Public attendee list.
- Check-out/time tracking unless specifically needed.

## Remaining Questions

1. How strict should check-in windows be?
2. Should waitlisted users ever be check-in eligible at the door if capacity remains?
3. Should the app support walk-up approval by MCs, or only pre-approved registrations?
4. Should no-shows be marked automatically after event end, or by an organizer action?
5. Does `totalMinutesAttended` still matter, and if so how should it be calculated?
