# HTTP API Contracts: Event Management Foundations

All endpoints use the existing Next.js route handler style under `src/app/api`. JSON responses should return `401` for unauthenticated users, `403` for authenticated but unauthorized users, `404` when the caller must not learn a private resource exists, and validation errors as `400`.

## Chapters

### `GET /api/chapters`

Returns chapters visible to the current caller.

**Visibility**

- Signed-out users see active public chapters.
- Signed-in users also see private chapters where they are invited or active members.
- Site admins see all chapters.
- Chapter admins see their chapters.

### `POST /api/chapters`

Creates a chapter. Site-admin only.

**Body**

```json
{
  "name": "Boston",
  "slug": "boston",
  "city": "Boston",
  "region": "MA",
  "country": "US",
  "timezone": "America/New_York",
  "description": "Sundai Boston",
  "accessMode": "PUBLIC",
  "status": "ACTIVE"
}
```

### `GET /api/chapters/[chapterId]`

Returns chapter details if `canViewChapter` passes. Private unauthorized chapters return `404`.

### `PATCH /api/chapters/[chapterId]`

Updates chapter settings. Site admins and chapter admins for the chapter only.

### `POST /api/chapters/[chapterId]/admins`

Assigns an active chapter admin. Site admins and chapter admins for the chapter only, subject to project policy.

### `DELETE /api/chapters/[chapterId]/admins/[hackerId]`

Removes a chapter admin. Must reject removal if it would leave the chapter with no admin.

### `GET /api/chapters/[chapterId]/members`

Lists active, invited, revoked, and left membership records. Site admins and chapter admins for the chapter only.

### `POST /api/chapters/[chapterId]/join`

Joins a public active chapter as the current signed-in hacker.

### `POST /api/chapters/[chapterId]/leave`

Leaves a chapter as the current signed-in hacker. Must reject if the user is the only chapter admin.

### `POST /api/chapters/[chapterId]/invites`

Creates or reactivates an invited membership for a private chapter. Site admins and chapter admins for the chapter only.

### `POST /api/chapters/[chapterId]/invites/accept`

Accepts the current hacker's invitation and makes the membership active.

### `PATCH /api/chapters/[chapterId]/notifications`

Updates current member notification permission and channel preferences.

## Application Templates

### `GET /api/application-templates`

Returns templates visible to the caller. Site admins can query all; chapter admins can query their chapter template and the active site template.

### `POST /api/application-templates`

Creates a site or chapter application template. Site admins can create site templates and any chapter template; chapter admins can create templates for their own chapter.

### `PATCH /api/application-templates/[templateId]`

Updates a template and validates that site-required fields remain present.

### `GET /api/application-templates/merged?chapterId=...&eventId=...`

Returns the composed field set in site, chapter, event order. Event configuration may hide chapter-default questions but never site-required questions.

## Events

### `GET /api/events`

Preserves existing event list behavior and supports organizer filtering for manageable events when called from organizer surfaces.

### `POST /api/events`

Creates an event. Site admins can create in any chapter; chapter admins can create in their chapters.

### `GET /api/events/[eventId]`

Returns event details according to existing public behavior and organizer permissions.

### `PATCH /api/events/[eventId]`

Updates event metadata according to `canManageEventSettings`.

### `POST /api/events/[eventId]/publish`

Publishes a draft event. Site admins and chapter admins for the event chapter only.

### `POST /api/events/[eventId]/staff`

Assigns MC or co-MC. Site admins and chapter admins for the event chapter only.

### `DELETE /api/events/[eventId]/staff/[staffId]`

Removes an event staff assignment. Site admins and chapter admins for the event chapter only.

## Registrations

### `GET /api/events/[eventId]/registrations`

Internal organizer/admin foundation endpoint. Site admins, chapter admins for the event chapter, and assigned MCs may read relevant registrations. Non-site-admin results must exclude active globally banned users without exposing ban state.

### `POST /api/events/[eventId]/registrations`

Creates an internal registration record. This is not a public RSVP endpoint in Phase 1.

### `PATCH /api/events/[eventId]/registrations/[registrationId]`

Updates internal registration status and writes an audit record. Co-MCs cannot approve, waitlist, or decline.

## Global Bans

### `GET /api/admin/bans`

Lists global bans. Site-admin only.

### `POST /api/admin/bans`

Creates a permanent global ban. Site-admin only.

### `PATCH /api/admin/bans/[banId]`

Revokes a global ban while preserving audit history. Site-admin only.

### `GET /api/admin/ban-flags`

Lists chapter-admin ban review flags. Site-admin only.

### `PATCH /api/admin/ban-flags/[flagId]`

Resolves a ban flag. Site-admin only.

### `POST /api/chapters/[chapterId]/ban-flags`

Creates a site-admin review item. Chapter admins for the chapter and site admins only. Does not create a ban or expose the global ban list.

## Organizer Notes

### `GET /api/hackers/[hackerId]/organizer-note`

Returns the current note body only when `canViewOrganizerNotes` passes.

### `PUT /api/hackers/[hackerId]/organizer-note`

Updates the current note body and writes a text-patch revision when the caller can edit relevant notes.

### `GET /api/hackers/[hackerId]/organizer-note/revisions`

Returns revisions only to site admins and relevant chapter admins.
