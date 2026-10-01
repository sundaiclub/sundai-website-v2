// Run only against the disposable local database described in docs/email-queue.md.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  createEmailBatches,
  processEmailBatch,
  EmailQueueBusy,
} from '../src/lib/emailQueue';

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/sundai_queue_test') {
  throw new Error(
    'This test requires the disposable local sundai_queue_test database.'
  );
}
const db = new PrismaClient();
const sent = {
  status: 'SENT' as const,
  providerMessageId: 'test-ses-id',
  errorCode: null,
  errorMessage: null,
};
const reserve = async () => {};
const message = (index: number) => ({
  to: `member${index}@example.com`,
  subject: 'Test',
  body: 'Test body',
});

async function run() {
  const before = await db.emailDeliveryBatch.count();
  await assert.rejects(
    db.$transaction(async tx => {
      await createEmailBatches(tx, [message(1)]);
      throw new Error('Rollback');
    })
  );
  assert.equal(await db.emailDeliveryBatch.count(), before);

  const ids = await db.$transaction(tx =>
    createEmailBatches(
      tx,
      Array.from({ length: 3001 }, (_, index) => message(index))
    )
  );
  assert.equal(ids.length, 301);
  let sends = 0;
  const sendEmail = async () => {
    sends++;
    return sent;
  };
  await Promise.all(
    Array.from({ length: 8 }, () =>
      processEmailBatch(ids[0], { db, reserve, sendEmail })
    )
  );
  assert.equal(sends, 10, 'Competing consumers must send one batch only once');
  await processEmailBatch(ids[0], { db, reserve, sendEmail });
  assert.equal(sends, 10, 'Completed batches must not resend');
  for (const id of ids.slice(1))
    await processEmailBatch(id, { db, reserve, sendEmail });
  assert.equal(sends, 3001);
  assert.equal(
    await db.emailDeliveryBatch.count({
      where: { id: { in: ids }, status: 'COMPLETED' },
    }),
    301
  );

  const [interrupted] = await db.$transaction(tx =>
    createEmailBatches(tx, [message(1)])
  );
  await db.emailDeliveryBatch.update({
    where: { id: interrupted },
    data: { status: 'PROCESSING', claimToken: 'test', claimedAt: new Date() },
  });
  await assert.rejects(
    processEmailBatch(interrupted, { db, sendEmail }),
    EmailQueueBusy
  );
  await db.emailDeliveryBatch.update({
    where: { id: interrupted },
    data: { claimedAt: new Date(Date.now() - 121000) },
  });
  await processEmailBatch(interrupted, { db, sendEmail });
  assert.equal(sends, 3001, 'Interrupted sends must not be retried');
  const unknown = await db.emailDeliveryBatch.findUniqueOrThrow({
    where: { id: interrupted },
  });
  assert.equal(unknown.failedCount, 1);
  assert.equal(
    (unknown.outcomes as any[])[0].errorCode,
    'SEND_OUTCOME_UNKNOWN'
  );

  const key = randomUUID();
  const hacker = await db.hacker.create({
    data: { clerkId: key, name: 'Queue Test' },
  });
  const chapter = await db.chapter.create({
    data: {
      name: 'Queue Test',
      slug: key,
      city: 'Boston',
      country: 'US',
      timezone: 'America/New_York',
    },
  });
  const event = await db.event.create({
    data: {
      chapterId: chapter.id,
      createdById: hacker.id,
      title: 'Queue Test',
      slug: key,
      timezone: 'America/New_York',
      startTime: new Date(),
    },
  });
  const communication = await db.eventCommunication.create({
    data: {
      eventId: event.id,
      createdById: hacker.id,
      channel: 'EMAIL',
      status: 'SENDING',
      body: 'Test',
      audienceType: 'APPROVED',
      audienceDefinitionJson: {},
      recipientCount: 1,
    },
  });
  const recipient = await db.eventCommunicationRecipient.create({
    data: {
      communicationId: communication.id,
      hackerId: hacker.id,
      contactValue: 'member1@example.com',
      displayName: 'Queue Test',
    },
  });
  const [eventBatch] = await db.$transaction(tx =>
    createEmailBatches(
      tx,
      [{ ...message(1), eventRecipientId: recipient.id }],
      { eventCommunicationId: communication.id }
    )
  );
  await processEmailBatch(eventBatch, {
    db,
    reserve,
    sendEmail: async () => ({
      status: 'FAILED',
      providerMessageId: null,
      errorCode: 'Throttling',
      errorMessage: 'Test rejection',
    }),
  });
  const result = await db.eventCommunication.findUniqueOrThrow({
    where: { id: communication.id },
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failedCount, 1);
  assert.equal(
    (
      await db.eventCommunicationRecipient.findUniqueOrThrow({
        where: { id: recipient.id },
      })
    ).errorCode,
    'Throttling'
  );

  const edition = await db.weeklyEmail.create({
    data: { subject: 'Queue Test', body: 'Test', status: 'SENDING' },
  });
  const weeklyIds = await db.$transaction(tx =>
    createEmailBatches(
      tx,
      Array.from({ length: 11 }, (_, index) => message(index)),
      { weeklyEmailId: edition.id }
    )
  );
  await processEmailBatch(weeklyIds[0], { db, reserve, sendEmail });
  assert.equal(
    (await db.weeklyEmail.findUniqueOrThrow({ where: { id: edition.id } }))
      .status,
    'SENDING'
  );
  await processEmailBatch(weeklyIds[1], { db, reserve, sendEmail });
  assert.equal(
    (await db.weeklyEmail.findUniqueOrThrow({ where: { id: edition.id } }))
      .status,
    'SENT'
  );

  process.env.AWS_REGION = `test-${key}`;
  const rateIds = await db.$transaction(tx =>
    createEmailBatches(
      tx,
      Array.from({ length: 21 }, (_, index) => message(index))
    )
  );
  const starts: number[] = [];
  for (const id of rateIds) {
    let first = true;
    await processEmailBatch(id, {
      db,
      sendEmail: async () => {
        if (first) starts.push(Date.now());
        first = false;
        return sent;
      },
    });
  }
  assert.ok(starts[1] - starts[0] >= 950);
  assert.ok(starts[2] - starts[1] >= 950);
  console.log(
    'PASS: migration, atomic rollback, 3,001 emails, competing consumers, queue redelivery, interrupted sends, event results, weekly completion, and shared database rate limit. No external email calls.'
  );
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
