# Data migrations

## Boston email subscribers

Deploy `20261020000000_optional_hacker_clerk_id` and the Clerk webhook change
before importing subscribers. New platform profiles have `clerkId: null` until
Clerk sends a `user.created` event with a verified matching primary email. The
webhook claims only one unlinked profile and preserves its memberships.

`scripts/import-boston-subscribers.cjs` reads a semicolon-delimited subscriber
CSV and the current Clerk users. It never creates or changes Clerk accounts and
never sends messages. Set `DATABASE_URL` and `CLERK_SECRET_KEY` for the same
environment. Keep the CSV and reports outside version control.

Run a dry run first:

```bash
mkdir -p .data/subscriber-imports
node scripts/import-boston-subscribers.cjs --csv /path/to/subscribers.csv \
  --report .data/subscriber-imports/dry-run.json
```

Review the counts and private report. Apply that exact plan with a new report:

```bash
node scripts/import-boston-subscribers.cjs --csv /path/to/subscribers.csv \
  --report .data/subscriber-imports/applied.json \
  --apply --expected-plan PLAN_HASH_FROM_DRY_RUN
```

The command refreshes Clerk and database state. It stops if the plan changed.
Profile and membership inserts run in one transaction. It holds table locks
during the short database write phase to prevent a concurrent signup from
creating a duplicate email profile. Reports have owner-only permissions and
include the source hash, per-contact decisions, and inserted profile IDs.

Rules:

- Exclude any CSV blocklist entry, including a block on another Clerk email
  belonging to the same account. Require an email marketing subscription.
- Exclude duplicate profiles, identity conflicts, missing Clerk accounts,
  changed Clerk emails, active bans, and locked Clerk accounts.
- Preserve all existing memberships and preferences. Skip inactive memberships
  and memberships with either email or all notifications disabled.
- Match primary and secondary Clerk emails to the existing platform account.
- Create missing platform profiles and active Boston memberships. Enable email
  and leave SMS disabled on new memberships. Record import provenance in the
  new membership's notification metadata.
- A repeat dry run after a successful import must propose zero inserts.

Run the import tests with:

```bash
node --test tests/data-migrations/boston-subscribers.test.cjs
```

These migrations combine database writes with external services and therefore
cannot run inside Prisma's SQL-only migration transaction.

## Sundai Boston historical events

`20260807000000_backfill_sundai_boston_events.ts` imports the checked-in
Partiful manifest and event images. It:

1. uploads each image to the configured private S3 image bucket, served by CloudFront;
2. upserts a published Boston event with `Boston, MA` as its public location;
3. stores the Partiful location as the private address and approved-only detail;
4. finds Boston pitch sessions on the same local calendar day;
5. attaches unclaimed legacy sessions and upserts their projects into
   `EventProject` with approved card status.

The IDs, slugs, and S3 object keys are deterministic, so the command is safe to
rerun after a partial failure:

```bash
npm run db:backfill:sundai-boston
```

Required environment variables are `DATABASE_URL` (or `DIRECT_URL`),
`S3_IMAGE_REGION`, `S3_IMAGE_BUCKET`, and `S3_IMAGE_PUBLIC_BASE_URL`. The manual
import uses the AWS CLI profile selected by `AWS_PROFILE` (default: `default`).

To rebuild the checked-in image directory from the public source URLs in the
manifest, run:

```bash
npm run fetch:sundai-boston-images
```
