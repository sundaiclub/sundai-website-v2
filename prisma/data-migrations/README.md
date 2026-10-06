# Data migrations

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
