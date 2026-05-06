# Sundai Event Management Redesign

Date: 2026-05-05
Updated: 2026-05-06

This planning packet breaks the Partiful replacement and chapter-aware event system into five implementation phases. Each phase has its own file with the settled decisions, implementation scope, non-goals, and remaining questions.

## Phase Docs

1. [Phase 1: Foundations](./event-management-phase-1-foundations.md)
2. [Phase 2: Native Event Pages and RSVP](./event-management-phase-2-native-events-rsvp.md)
3. [Phase 3: Check-In and Attendance Cutover](./event-management-phase-3-check-in-attendance.md)
4. [Phase 4: Organizer Event Workspace](./event-management-phase-4-organizer-workspace.md)
5. [Phase 5: Reporting and Post-Hack Outputs](./event-management-phase-5-reporting.md)

## Settled Product Decisions

- Existing data backfills into a `Boston` chapter.
- Chapter admins can publish events immediately. There is no site-admin approval step in the default flow.
- MCs can approve, waitlist, and reject applicants.
- Co-MCs have event management powers for pitch, resources, materials, communications, and operations, but cannot approve, waitlist, or reject applicants.
- Globally banned users are hidden from MC and co-MC review queues and default-rejected/blocked internally. MCs do not need visibility into the ban list.
- Ban list is global only for now. Only site admins can add permanent global bans.
- MC notes are internal, visible to site admins, chapter admins, MCs, and co-MCs on the relevant review surfaces, and hidden from users.
- MC notes are global to a hacker and work like a shared notepad edited by organizers; diff-based edit history is visible only to chapter admins and site admins.
- Application templates exist at site level, chapter level, and event custom-question level.
- Chapter templates use one active chapter default question set.
- Site-required application fields should include phone number because SMS is planned.
- Waitlisted users only see that they are on the waitlist, not their position.
- Guests are not supported.
- Users can cancel their RSVP.
- Pending users can edit application answers; the original submission time is preserved and `updatedAt` changes.
- Manual application closure blocks all new applications.
- Waitlist auto-promotion is event-toggleable and defaults off.
- Self check-in requires scanning an event QR code on-site.
- Exact event details and sensitive resources can be hidden until approval.
- Projects can be pitched across multiple events.
- Pitch queue work is already handled by `/pitch`; this redesign should reuse it.
- Public project outcomes can be visible to non-approved users after events.
- Partiful import is forward-looking only for now. No historical import in the first cutover.
- Chapters get chapter pages and their own mailing lists, not separate bespoke landing pages.
- Templates exist at both site and chapter levels.

## Still Open

- Email provider for production blasts.
- SMS provider and consent details. Twilio is the likely provider.
- Sponsor access model.
- First-time attendee onboarding policy.
- Which event program type labels should be public versus internal metadata.
- Public message text for users who are blocked by the ban-list rule.
- Public declined-user message text.

## Further Thoughts

- Build permission helpers before UI work. The current app has many direct `role === "ADMIN"` checks, and the chapter/MC/co-MC split will become fragile if every route reimplements permissions.
- Treat the ban-list path as site-admin-only infrastructure. MCs should simply receive a cleaner applicant queue; they do not need counts, names, or reasons unless the team later decides chapter admins should have limited visibility.
- Store application schema snapshots on submissions. Site and chapter templates will evolve, and old applications must remain readable after template changes.
- Keep `/pitch` stable at first. The pitch system already exists, so the event workspace should wrap and permission it rather than rebuild it.
- Separate public event wording from approved-only details. This is central to replacing Partiful without leaking address, Zoom, toolkit, or sponsor resources.
- Use event attendance as the new source of truth and stop creating new week attendance records once the check-in cutover lands.
- Make communications auditable from day one: who sent what, to which audience snapshot, through which provider, with what delivery result.
- Treat MC notes as a collaborative notepad plus audit trail, not as separate comment threads.

## Explicitly Not Happening Right Now

- Maintaining Partiful as a parallel event source of truth.
- Importing old Partiful attendee/event history.
- Guest RSVPs.
- Temporary bans, chapter-specific bans, or event-specific bans.
- Automated ban-like enforcement from MC notes.
- Exposing ban-list membership to MCs.
- Public waitlist positions.
- Separate custom chapter marketing homepages.
- Rebuilding the pitch queue from scratch.
- Fully automated social/newsletter/sponsor publication without human review.
