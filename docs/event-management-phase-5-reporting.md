# Phase 5: Reporting and Post-Hack Outputs

## Purpose

Turn clean event data into useful post-hack outputs: event metrics, project highlights, newsletter/social drafts, sponsor reports, and chapter-level history. This phase addresses the spreadsheet pain points around manual social posts, newsletter curation, sponsor follow-up, and lost knowledge from previous hack designs.

## Settled Decisions For This Phase

- Public project outcomes can be visible to non-approved users after an event.
- Projects can appear across multiple events.
- Historical Partiful import is not part of the first cutover.
- Fully automated publication is not the goal. Humans should review drafts.
- Chapters have their own mailing lists.
- Sponsor access remains TBD.
- Event program types/templates exist at site and chapter levels.

## Reporting Inputs

By this phase, the system should have structured data for:

- chapter
- event title/program type/template
- event public description
- attendance/check-in count
- RSVP counts by status
- no-show count
- project cards attached to event
- project card completion state
- pitch queue order
- pitch votes
- top projects
- highlighted projects
- MC notes where relevant internally
- materials/toolkit links
- sponsor/expert metadata if entered
- blasts and delivery logs

## Event Report Page

Add an organizer report view:

- `/organizer/events/[eventId]/report`

Sections:

- event summary
- attendee funnel
- attendance
- project outcomes
- pitch outcomes
- top/highlighted projects
- incomplete project cards
- communications summary
- exports
- social/newsletter/sponsor drafts

Metrics:

- applications submitted
- approved count
- waitlisted count
- declined count
- cancelled count
- checked-in count
- no-show rate
- project count
- complete project card percentage
- pitch count
- top project vote counts
- blast delivery counts if available

## Public Event Outcomes

Public pages can show:

- event title/chapter/date
- public description
- public project gallery
- top/highlighted projects
- public recap text if published

Do not show:

- attendee application data
- MC notes
- internal organizer notes
- ban information
- private approved-only resources unless intentionally published
- sponsor-private report sections

## Social Drafts

Generate drafts from selected/highlighted `EventProject` records.

Inputs:

- project title
- preview/description
- team members
- GitHub/demo/blog links
- project image
- pitch votes/top-project status
- event theme/program type

Output:

- LinkedIn draft
- short social draft
- image/link checklist
- people to tag if profile links exist

Important:

- Human review required.
- Do not auto-post in this phase.
- Avoid overstating sponsor/user outcomes beyond what project data supports.

## Newsletter Drafts

Generate a section for the chapter mailing list and/or site-wide newsletter.

Inputs:

- event summary
- top projects
- relevant AI/tooling learnings if captured
- upcoming events
- sponsor acknowledgment if public

Output:

- editable HTML or markdown draft
- selected projects list
- links back to project pages

Integration with the current `NewsClient` can happen here, but do not block reporting on a full newsletter system redesign.

## Sponsor Reports

Sponsor access is TBD, so build report generation before building a sponsor portal.

Draft report contents:

- event overview
- goals and hack program type
- attendance/application funnel
- project gallery
- highlighted demos
- useful links
- organizer notes for sponsor follow-up, if public-safe
- feedback section placeholder

Delivery options:

- export as markdown/HTML/PDF later
- private share link later
- sponsor account/role later

Do not expose internal MC notes or application decisions in sponsor reports.

## Chapter History

The spreadsheet asks for a searchable log of previous hacks and how they were done. Phase 5 should make chapter history useful:

- event list by chapter
- filter by program type
- filter by sponsor/expert/tool
- show materials that are reusable
- show project outcomes
- clone event/template from past event

This is where event templates become more powerful:

- site-level templates for Sundai-wide formats
- chapter-level templates for local defaults
- event-level custom questions for one-off needs

## Exports

Useful exports:

- registrations CSV
- attendance CSV
- project outcomes CSV
- project cards missing required fields
- communications delivery summary
- sponsor report markdown/HTML

Exports should enforce permissions:

- site admin: all
- chapter admin: chapter events
- MC/co-MC: assigned events, with no ban-list data

## API Scope

New routes:

- `GET /api/events/[eventId]/report`
- `POST /api/events/[eventId]/report/social-draft`
- `POST /api/events/[eventId]/report/newsletter-draft`
- `POST /api/events/[eventId]/report/sponsor-draft`
- `GET /api/events/[eventId]/exports/registrations`
- `GET /api/events/[eventId]/exports/attendance`
- `GET /api/events/[eventId]/exports/projects`
- `GET /api/chapters/[chapterId]/history`

## Tests

Add tests for:

- Public report excludes private fields.
- Organizer report includes correct counts.
- MC/co-MC exports exclude ban data.
- Public event outcomes visible to non-approved users.
- Newsletter/social draft only uses public-safe project data.
- Sponsor draft excludes MC notes and internal application data.
- Chapter history filters by program type.

## Not Happening In This Phase

- Auto-posting to social platforms.
- Auto-sending newsletters without review.
- Historical Partiful import.
- Sponsor portal unless separately chosen.
- Public exposure of MC notes/application answers.
- Automated scoring or rejection decisions.

## Remaining Questions

1. What should sponsor access be: exported report, private share link, sponsor user role, or no in-app sponsor access?
2. Should public event outcomes be published automatically when an event finishes, or manually by organizers?
3. Which project fields are mandatory for a project to appear in public highlights?
4. Should chapter mailing lists be managed inside Sundai or synced to an external provider?
5. Should event program type be public on recap pages, or internal unless the organizer writes a public label?
6. Should report drafts use AI generation, deterministic templates, or both?
7. Who can mark a project as highlighted: MCs, co-MCs, chapter admins, site admins?

