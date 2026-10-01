# Weekly emails

Site admins can open **Admin → Weekly emails** to save a draft, preview its Markdown, send a test to their own account, or send the edition. Both send actions save the current editor content first. A test does not consume the draft.

## Setup

Deploy the Prisma migration `20260917000000_weekly_emails` before using the page. Use the project's normal migration command (`npm run db:migrate:deploy`). The feature uses the existing `AWS_REGION`, `AWS_SES_FROM_EMAIL`, and AWS credentials. Set `NEXT_PUBLIC_APP_URL` to the site's public HTTPS address for email links and the logo.

## Selection rules

- An eligible recipient has an email address, no active global ban, and at least one active chapter membership with both `notificationsAllowed` and `emailNotificationsEnabled` set.
- Each eligible user receives one email. Upcoming events come from all of that user's active chapter memberships, including memberships with email disabled.
- Each chapter contributes up to two of its earliest future `PUBLISHED` events. Only public location details are included. Chapters with no upcoming event have no event section.
- The ranking includes distinct, approved, non-broken projects from public events in public chapters. The event must be published or archived and must have ended in the preceding 168 hours. Events without an end time do not qualify.
- Rank projects by project likes created in those same 168 hours, excluding likes from globally banned users. Exclude projects whose launch lead has an active global ban. Ties use project ID for a stable order. Include up to five projects, including zero-like projects if fewer than five have likes.
- The first word of the member's name is used in the greeting. An empty name produces “Hi there”.

## Sending behavior

Sending is manual and uses the shared [Vercel email queue](email-queue.md).
Both full editions and self tests are queued. The response confirms queue
publication, not email delivery. The page polls for accepted and failed counts;
you can close it while the worker continues.

An atomic draft lock and batch snapshot prevent concurrent sends of the same
edition. Once queued, the edition is removed from the draft list. Each batch
stores its rendered messages and results in Postgres. No failed or uncertain
email send is retried. Weekly edition status becomes SENT when all batches have
finished; use the batch results to distinguish provider acceptance from failure.

If queue publication fails, the saved work remains pending. A site admin can
use **Resume queued emails** on the weekly email page. This queues only batches
that have never started and also recovers pending event and decision emails.
An interrupted batch is marked with SEND_OUTCOME_UNKNOWN for manual review;
check the provider before any manual resend.

The shared Markdown editor is used for weekly emails, event descriptions, and project descriptions. It retains formatting controls, image upload, paste/drop support, and Markdown preview.
