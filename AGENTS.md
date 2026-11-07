<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/003-organizer-event-workspace/plan.md`
<!-- SPECKIT END -->

## Public data and privacy

- Use the shared field lists in `src/lib/publicData.ts` for public project,
  member, image, and chapter data. Use a Prisma `select` to limit the query,
  then use `publicFields` to limit the response. Do not return or spread a full
  database record into a public response. New database fields must stay private
  unless they are added to an explicit public field list.
- Keep email addresses, phone numbers, Clerk account IDs, account roles, SMS
  consent records, attendance data, organizer notes, application answers, and
  moderation records out of public responses. A member can read their own
  contact details and role. Other private reads require a server check for the
  required event, chapter, or site permission. Sign-in alone is not permission
  to read another member's private data.
- Use `visibleProjectsWhere` for project lists and related profile or chapter
  queries. Use `projectReadAccessWhere` for direct project reads with event or
  judge access. Only `APPROVED` projects are public. Draft and pending projects,
  and projects hidden by an event, require verified team or staff access. Set
  the site administrator flag only from the current user's verified database
  role, never from request data.
- Public images can include their URL and alt text. Keep storage keys, bucket
  names, original file names, and generation prompts private. Return a project
  thumbnail prompt only to an authorized project editor.
- Public chapter data must not include administrator email addresses, private
  membership metadata, mailing list IDs, or decision message templates. Use the
  separate authorized management routes for private chapter data.
- Use `privateJson` for project, profile, and chapter API responses so that they
  use `Cache-Control: private, no-store`. Apply these data limits to nested
  records, server component props, page metadata, and mutation responses too.
  A hidden UI field or a middleware rule does not replace a server data check.
- For changes to these data paths, run
  `npm test -- --runInBand tests/api/public-data-privacy.test.ts` and the related
  access tests. Add tests for new fields and routes. Check anonymous users,
  unrelated signed-in users, owners, and authorized staff. Include bulk and
  paginated lists, nested records, and direct draft reads. Use fake private
  values in tests; do not copy real member data into fixtures or logs.
- Before a release that changes these data paths, run the type check, lint,
  tests, and production build. After deployment, check the public project and
  chapter APIs without a session. Confirm that private fields are absent, draft
  lists are empty, and direct draft API reads return 404. Keep the fix in the
  Git release path as well as the live deployment; a manual deployment does
  not update `v3` or `main`.
