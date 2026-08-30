# Quickstart: Organizer Event Workspace

## Prerequisites

- Work on branch `003-event-workspace`.
- Install project dependencies with the existing Node package workflow.
- Configure `DATABASE_URL` and Clerk test/development credentials.
- For file-material testing, configure the existing Google Cloud Storage credentials/bucket with private object access and signed URL support.
- For delivery testing, configure AWS SES and/or Twilio. A missing provider keeps that channel unavailable rather than failing the rest of the workspace.
- Configure an approved SMS consent copy/version before enabling SMS consent capture; records without `smsConsentAt` and `smsConsentVersion` are ineligible.

## Implementation Order

1. Add Prisma enums/models/indexes and the one-role-per-event staff constraint; migrate existing duplicate staff assignments deterministically.
2. Cut over shared authorization helpers and route guards, including authorized staff reads and admin-only lifecycle/settings/staff actions.
3. Add workspace overview/read models and route shell.
4. Add private material upload intents, finalization, access-checked downloads, audits, public/approved projections, and UI.
5. Add communication drafts, audience resolution/fingerprints, immutable recipient snapshots, SES/Twilio delivery results, and UI.
6. Cut organizer-note consumers to explicit event scope and add the Notes section.
7. Add event project/card-status read/update behavior and the Pitch section link to the focused controller.
8. Add reporting preview with phase 3 metrics explicitly unavailable.
9. Run focused and full validation.

## Focused Verification

```bash
npx prisma validate
npx prisma generate
npm run test -- --runInBand tests/lib/eventManagementAuth.test.ts
npm run test -- --runInBand tests/api/event-staff.test.ts
npm run test -- --runInBand tests/api/event-registration-review.test.ts
npm run test -- --runInBand tests/api/organizer-notes.test.ts
npm run test -- --runInBand tests/api/event-materials.test.ts
npm run test -- --runInBand tests/api/event-communications.test.ts
npm run test -- --runInBand tests/api/organizer-event-workspace.test.ts
npm run test -- --runInBand tests/pages/OrganizerEventWorkspace.test.tsx
npm run test -- --runInBand tests/api/events-transition.test.ts tests/api/events-queue.test.ts tests/api/event-project-vote.test.ts
```

New test filenames above are expected targets for implementation.

### Verification Record — 2026-07-10

All focused commands above were executed from the repository root without
feature corrections between runs.

| Command                                                                                                                               | Result                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `npx prisma validate`                                                                                                                 | PASS — `prisma/schema.prisma` is valid.             |
| `npx prisma generate`                                                                                                                 | PASS — Prisma Client 5.22.0 generated successfully. |
| `npm run test -- --runInBand tests/lib/eventManagementAuth.test.ts`                                                                   | PASS — 48/48 tests.                                 |
| `npm run test -- --runInBand tests/api/event-staff.test.ts`                                                                           | PASS — 7/7 tests.                                   |
| `npm run test -- --runInBand tests/api/event-registration-review.test.ts`                                                             | PASS — 16/16 tests.                                 |
| `npm run test -- --runInBand tests/api/organizer-notes.test.ts`                                                                       | PASS — 12/12 tests.                                 |
| `npm run test -- --runInBand tests/api/event-materials.test.ts`                                                                       | PASS — 6/6 tests.                                   |
| `npm run test -- --runInBand tests/api/event-communications.test.ts`                                                                  | PASS — 7/7 tests.                                   |
| `npm run test -- --runInBand tests/api/organizer-event-workspace.test.ts`                                                             | PASS — 6/6 tests.                                   |
| `npm run test -- --runInBand tests/pages/OrganizerEventWorkspace.test.tsx`                                                            | PASS — 5/5 tests.                                   |
| `npm run test -- --runInBand tests/api/events-transition.test.ts tests/api/events-queue.test.ts tests/api/event-project-vote.test.ts` | PASS — 3 suites, 42/42 tests.                       |

Focused total: 11 successful commands and 149 passing tests. No failed,
skipped, or updated snapshots were reported.

Query-shape review notes:

- Workspace aggregates use database counts/grouping with event-scoped filters;
  hidden globally banned registrations are excluded for non-site-admin actors.
- Inline workspace staff and pitch-session summary relations are capped at 100.
- Material lists are event-scoped, deterministically ordered, and normalize
  pagination to a maximum page size of 100.
- Project workspace lists use deterministic ordering, a maximum page size of
  100, and one-row lookahead for `nextOffset`.
- Organizer note targets and revision history use bounded pagination (maximum
  100); revision reads filter by hacker and order newest first.
- Communication snapshot creation keeps the indexed communication/status
  transition atomic and projects only recipient IDs/contact values needed for
  delivery, ordered deterministically.
- Event, staff, registration, material, communication, project, and note reads
  retain their event/chapter/hacker filters aligned with the indexes declared
  in `prisma/schema.prisma`.

## Full Verification

```bash
npm run test -- --runInBand
npm run build
```

## Acceptance Matrix

- Site admin: any workspace; administer event/staff; decisions; operations; note history; pitch.
- Chapter admin: same within active chapter scope only.
- MC: assigned event operations, communications, materials, notes, decisions, and pitch; no staff/lifecycle administration.
- Co-MC: assigned event operations, communications, materials, notes, and pitch; no applicant decisions or staff/lifecycle administration.
- Approved attendee: public plus approved-attendee materials only.
- Pending/waitlisted/declined/cancelled/anonymous: public materials only.
- Removed staff/unauthorized user: next request denied with no private workspace data.

## Required Regression Checks

- Globally blocked hackers never affect non-site-admin rows, counts, audiences, notes, projects, or exports.
- Material object keys do not bypass visibility; restricted downloads require current authorization.
- Invalid/oversized files create no material record.
- Send-time audience changes return `409` and send nothing until reconfirmed.
- Recipient snapshots remain unchanged after registration/preference changes.
- Partial delivery failures do not alter registrations or successful recipient results.
- Organizer notes/revisions never serialize into public/attendee/message/reporting responses.
- Co-MC pitch controls still work and co-MC registration decisions still fail.
- Project-card status never blocks existing pitch queue/voting behavior.
- No workspace route, audience enum, count, or report uses legacy `Week`/`Attendance` as event attendance.

### Project Entry Cutover Verification — 2026-08-28

| Command | Result |
| --- | --- |
| `npm run test -- --runInBand` | PASS — 147 suites, 1,119 tests. |
| `npx tsc --noEmit` | PASS — no type errors. |
| `npm run build` | PASS — production build and static generation completed. |

Verified behaviors include visible current-event selection, no hidden chapter-based attachment, publish-time event participation, source-only pitch entry, closed-pitch handling, draft exclusion from public event projects, active-event project-entry visibility, shared project chooser state, and contextual return navigation.

### Project Entry Polish Verification — 2026-08-28

| Command | Result |
| --- | --- |
| Focused Jest suites | PASS — 4 suites, 23 tests. |
| `npm run test -- --runInBand` | PASS — 147 suites, 1,121 tests. |
| `npx tsc --noEmit` | PASS — no type errors. |
| `npm run build` | PASS — production build and static generation completed. |

Verified behaviors include the opaque shared chooser, standard placeholder images for events without uploads, current eligible events on the project edit page, protected existing event links, and additive event participation for approved projects.
