# UI Surface Contracts: Event Management Foundations

## Site Admin

### `/admin`

General site-admin console landing page. Must not expose content to non-site-admins.

**Links**

- `/admin/projects`
- `/admin/chapters`
- `/admin/application-templates`
- `/admin/bans`
- Organizer event surfaces as appropriate

### `/admin/projects`

Moved project moderation view. Preserves existing moderation behavior with `SITE_ADMIN` checks.

### `/admin/chapters`

Site-admin chapter management surface.

**Required capabilities**

- List chapters
- Create and edit chapters
- Pause/archive chapters
- Set public/private access
- Manage chapter admins
- Invite hackers to private chapters
- View membership states

### `/admin/application-templates`

Site-level and cross-chapter template management.

**Required capabilities**

- Edit active site template
- Ensure default required fields are name and email
- Select and edit chapter templates
- Preview merged site + chapter schema
- Reject removal of site-required fields

### `/admin/bans`

Global moderation surface. Site-admin only.

**Required capabilities**

- Search hackers
- Create permanent global ban
- Store public-safe reason and internal note separately
- Revoke bans
- View and resolve chapter-admin ban flags
- Never expose counts or reasons to non-site-admin users

## Public And Hacker

### `/chapters`

Chapter directory.

**Required behavior**

- Show active public chapters to everyone
- Show authorized private chapters only to invited users, active members, chapter admins, and site admins
- Link to chapter landing pages

### `/chapters/[chapterSlug]`

Chapter landing page.

**Required behavior**

- Show public chapter details and upcoming public chapter events
- Hide private chapters from unauthorized users
- Allow signed-in users to join public chapters
- Allow invited users to accept private chapter invitations
- Show current membership state
- Allow active members to update notification permission and email/SMS channel preferences
- Allow regular members to leave unless that would remove the only chapter admin

## Chapter And Event Organizer

### `/organizer/chapters/[chapterSlug]/settings`

Chapter-admin control surface.

**Required capabilities**

- Edit chapter metadata and access mode
- Manage admins and members
- Invite hackers to private chapters
- Revoke/remove memberships
- View notification permission state
- Edit active chapter application template
- Edit chapter description and image
- View ban flags created for the chapter

### `/organizer/events`

Organizer event index for site admins and chapter admins.

**Required behavior**

- Site admins see all events
- Chapter admins see only their chapter events
- MCs/co-MCs do not need this index in Phase 1

### `/organizer/events/new`

Event creation page for site admins and chapter admins.

**Required capabilities**

- Create event for an authorized chapter
- Capture title, slug, public description, public location summary, start/end time, timezone, capacity, visibility, application mode, program type, public label, approved-only details, and pitch timing defaults
- Assign MCs and co-MCs
- Attach event-level custom application questions
- Save draft or publish

### `/organizer/events/[eventId]/settings`

Event settings page with permission-specific editing.

**Required behavior**

- Site admins and chapter admins can fully edit authorized events
- MCs can edit assigned-event metadata and operational fields
- Co-MCs can edit resources/materials and operational fields
- Co-MCs cannot edit applicant decision settings or approve/waitlist/decline applicants

## Existing Pitch

### `/pitch` and `/pitch/[eventId]`

Keep the current pitch UX working.

**Required behavior**

- Replace `EventMC` data access with `EventStaff`
- Allow site admins, chapter admins for the event chapter, assigned MCs, and assigned co-MCs to manage pitch controls through shared helpers
- Read and write pitch phase, timer configuration, and queue data through the event's linked `PitchSession`
- Do not rebuild the pitch queue UI in Phase 1

## Existing Public Events

### `/events`

Leave the existing public event listing largely unchanged.

**Must not expose in Phase 1**

- Native public RSVP/application form
- Public native event detail route replacing the existing page
- Approved-only event details
- User RSVP status page
- QR check-in page
