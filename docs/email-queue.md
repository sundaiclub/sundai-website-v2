# Email queue

All application email uses `src/lib/emailQueue.ts` and the shared SES adapter in
`src/lib/eventDelivery.ts`. Event blasts, registration approvals/waitlist/decline
notices, weekly editions, and self tests queue email instead of sending it inside
the user request. Message templates stay in their feature modules. SMS remains
on its existing provider path.

## Deployment

1. Apply `20261001180000_email_delivery_queue` with the existing owner migration
   command (`npm run db:migrate:deploy`). The runtime uses the limited app login.
   Ensure the app role's existing default table privileges cover the new tables.
2. Deploy the application to Vercel with Node.js 24. The installed `@vercel/queue`
   SDK authenticates with Vercel OIDC. No queue API key is required on Vercel.
3. Keep `AWS_REGION`, `AWS_SES_FROM_EMAIL`, and the existing SES credentials on
   the queue function. Queue messages contain only a batch ID. The saved email
   content and recipient contacts remain in Postgres.
4. `vercel.json` declares the private `email-delivery` queue consumer with a
   concurrency limit of one. Producers use queue region `iad1`. The worker has
   a 60-second function allowance and a 120-second message visibility timeout.
   Deploy both the producer and consumer as one cutover.
5. Verify a self test with a test database and SES test identity before a live
   mailing. This source change does not send email or migrate production.

Vercel Queues is currently in beta. Its setup and SDK details are documented at
<https://vercel.com/docs/queues/quickstart> and
<https://vercel.com/docs/queues/sdk>.

## Sending and failures

- Recipient selection and rendered messages are saved at confirmation. Event
  recipient snapshots and email batches are committed in the same transaction.
  The weekly draft lock and its batches are also committed together.
- Each batch contains at most ten emails. The shared database rate limit grants
  one batch start each second per SES region, including overlapping deployments.
  This rate assumes the production SES quota remains at least 10 per second.
- The worker atomically changes a batch from QUEUED to PROCESSING before calling
  SES. Competing or duplicate queue deliveries cannot send the same batch again.
- One SES client per region and server process reuses up to ten connections.
  `maxAttempts: 1` disables SDK retries. Requests have a ten-second timeout.
- Results are committed after each batch. Event history and the weekly email
  page poll for progress. Successful API calls mean provider acceptance, not
  confirmed inbox delivery.
- Queue redelivery can resume database processing. It never retries a failed
  or uncertain SES send. After an interrupted PROCESSING claim expires, the
  worker records SEND_OUTCOME_UNKNOWN. Some emails in that batch may have been
  accepted by SES. Check the provider before a manual resend.
- If queue publication fails, the persisted batches remain QUEUED. A site admin
  can use **Resume queued emails** on the weekly email page, backed by
  `POST /api/admin/email-queue`. It republishes up to 500 QUEUED batches per call
  using stable idempotency keys. It does not reset PROCESSING or COMPLETED batches.
  Repeat if more batches remain. Event send confirmation also republishes only
  never-started batches when called again on a SENDING email communication.
- Queue messages expire after seven days. Saved pending batches can be resumed
  through the same admin control after expiry. Historical communications without
  queue batches are not imported or replayed.

## Local verification

Unit and route tests mock Vercel and SES. The database verification script only
accepts a disposable database named `sundai_queue_test` at `127.0.0.1`. It sends
3,001 simulated emails and checks competing consumers, interrupted claims,
provider failures, event/weekly completion, and the shared database rate limit.
It does not call Vercel or SES.

```sh
docker run --detach --rm --name sundai-email-queue-test \
  -e POSTGRES_PASSWORD=queue-test-only -e POSTGRES_DB=sundai_queue_test \
  -p 127.0.0.1:15432:5432 postgres:16-alpine
DATABASE_URL=postgresql://postgres:queue-test-only@127.0.0.1:15432/sundai_queue_test \
  npx prisma migrate deploy
DATABASE_URL=postgresql://postgres:queue-test-only@127.0.0.1:15432/sundai_queue_test \
  npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/test-email-queue.ts
docker stop sundai-email-queue-test
```

Use Node.js 24 for these commands. For a queue transport smoke test, use a
separate Vercel test project, `vercel link`, and `vercel env pull` to obtain OIDC
credentials. Confirm that its database and SES identity are test resources
before invoking a send route. No live queue smoke test is part of the local
verification above.
