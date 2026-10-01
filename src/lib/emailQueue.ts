import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from './prisma';
import { sendEventEmail, type EventDeliveryResult } from './eventDelivery';

export const EMAIL_QUEUE_TOPIC = 'email-delivery';
export const EMAIL_QUEUE_REGION = 'iad1';
export const EMAIL_BATCH_SIZE = 10;
const CLAIM_TIMEOUT_MS = 120_000;

export type QueuedEmail = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  eventRecipientId?: string;
};

export class EmailQueueBusy extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailQueueBusy';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function createEmailBatches(
  db: Prisma.TransactionClient,
  messages: QueuedEmail[],
  source: { eventCommunicationId?: string; weeklyEmailId?: string } = {}
) {
  const batches = [];
  for (let offset = 0; offset < messages.length; offset += EMAIL_BATCH_SIZE) {
    batches.push({
      id: randomUUID(),
      ...source,
      messages: messages.slice(
        offset,
        offset + EMAIL_BATCH_SIZE
      ) as Prisma.InputJsonValue,
    });
  }
  if (batches.length) await db.emailDeliveryBatch.createMany({ data: batches });
  return batches.map(batch => batch.id);
}

// A publish retry never retries an email: batch IDs are stable, and consumers
// atomically claim each batch before its first and only provider attempt.
export async function publishEmailBatches(ids: string[], db = prisma) {
  const { send } = await import('@vercel/queue');
  for (let offset = 0; offset < ids.length; offset += 5) {
    const results = await Promise.allSettled(
      ids.slice(offset, offset + 5).map(async batchId => {
        await send(
          EMAIL_QUEUE_TOPIC,
          { batchId },
          {
            region: EMAIL_QUEUE_REGION,
            idempotencyKey: batchId,
            retentionSeconds: 7 * 24 * 60 * 60,
          }
        );
        await db.emailDeliveryBatch.update({
          where: { id: batchId },
          data: { publishedAt: new Date() },
        });
      })
    );
    if (results.some(result => result.status === 'rejected')) {
      throw new Error(
        'Email queue publication failed. The saved batches can be queued again without resending attempted emails.'
      );
    }
  }
}

export async function enqueueEmails(messages: QueuedEmail[]) {
  const ids = await prisma.$transaction(tx => createEmailBatches(tx, messages));
  await publishEmailBatches(ids);
  return { queued: messages.length };
}

async function reserveEmailBatch(db: PrismaClient) {
  // Database time and one row per SES region enforce the rate across server
  // processes, queue consumers, and overlapping deployments.
  const slots = await db.$queryRaw<Array<{ startsAt: Date }>>`
    INSERT INTO "EmailDeliveryRateLimit" (region, "nextAvailableAt")
    VALUES (${process.env.AWS_REGION!}, CURRENT_TIMESTAMP + INTERVAL '1 second')
    ON CONFLICT (region) DO UPDATE SET "nextAvailableAt" =
      GREATEST("EmailDeliveryRateLimit"."nextAvailableAt", CURRENT_TIMESTAMP) + INTERVAL '1 second'
    WHERE "EmailDeliveryRateLimit"."nextAvailableAt" <= CURRENT_TIMESTAMP + INTERVAL '5 seconds'
    RETURNING "nextAvailableAt" - INTERVAL '1 second' AS "startsAt"
  `;
  if (!slots.length) throw new EmailQueueBusy('Email rate limit is busy.');
  const delay = slots[0].startsAt.getTime() - Date.now();
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function saveBatchResults(
  db: PrismaClient,
  batch: {
    id: string;
    claimToken: string | null;
    eventCommunicationId: string | null;
    weeklyEmailId: string | null;
  },
  messages: QueuedEmail[],
  outcomes: EventDeliveryResult[]
) {
  await db.$transaction(async tx => {
    const completed = await tx.emailDeliveryBatch.updateMany({
      where: {
        id: batch.id,
        status: 'PROCESSING',
        claimToken: batch.claimToken,
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sentCount: outcomes.filter(result => result.status === 'SENT').length,
        failedCount: outcomes.filter(result => result.status === 'FAILED')
          .length,
        outcomes: outcomes as Prisma.InputJsonValue,
      },
    });
    if (!completed.count) return;
    for (let index = 0; index < messages.length; index++) {
      if (messages[index].eventRecipientId) {
        await tx.eventCommunicationRecipient.updateMany({
          where: { id: messages[index].eventRecipientId, status: 'SENDING' },
          data: outcomes[index],
        });
      }
    }
    if (batch.eventCommunicationId) {
      await tx.$queryRaw`SELECT id FROM "EventCommunication" WHERE id = ${batch.eventCommunicationId} FOR UPDATE`;
      const where = { eventCommunicationId: batch.eventCommunicationId };
      const [totals, remaining] = await Promise.all([
        tx.emailDeliveryBatch.aggregate({
          where,
          _sum: { sentCount: true, failedCount: true },
        }),
        tx.emailDeliveryBatch.count({
          where: { ...where, status: { not: 'COMPLETED' } },
        }),
      ]);
      const sentCount = totals._sum.sentCount ?? 0;
      const failedCount = totals._sum.failedCount ?? 0;
      await tx.eventCommunication.update({
        where: { id: batch.eventCommunicationId },
        data: {
          sentCount,
          failedCount,
          status: remaining
            ? 'SENDING'
            : failedCount === 0
              ? 'SENT'
              : sentCount === 0
                ? 'FAILED'
                : 'PARTIAL',
          sentAt: remaining ? null : new Date(),
        },
      });
    }
    if (batch.weeklyEmailId) {
      await tx.$queryRaw`SELECT id FROM "WeeklyEmail" WHERE id = ${batch.weeklyEmailId} FOR UPDATE`;
      const remaining = await tx.emailDeliveryBatch.count({
        where: {
          weeklyEmailId: batch.weeklyEmailId,
          status: { not: 'COMPLETED' },
        },
      });
      if (!remaining)
        await tx.weeklyEmail.update({
          where: { id: batch.weeklyEmailId },
          data: { status: 'SENT' },
        });
    }
  });
}

export async function processEmailBatch(
  batchId: string,
  dependencies: {
    db?: PrismaClient;
    sendEmail?: typeof sendEventEmail;
    reserve?: (db: PrismaClient) => Promise<void>;
  } = {}
) {
  const db = dependencies.db ?? prisma;
  const batch = await db.emailDeliveryBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch || batch.status === 'COMPLETED') return;
  const messages = batch.messages as unknown as QueuedEmail[];
  if (batch.status === 'PROCESSING') {
    if (
      !batch.claimedAt ||
      Date.now() - batch.claimedAt.getTime() < CLAIM_TIMEOUT_MS
    ) {
      throw new EmailQueueBusy('The batch is still in progress.');
    }
    // SES has no idempotency key. Never resend a send whose outcome is unknown.
    await saveBatchResults(
      db,
      batch,
      messages,
      messages.map(() => ({
        status: 'FAILED',
        providerMessageId: null,
        errorCode: 'SEND_OUTCOME_UNKNOWN',
        errorMessage:
          'The worker stopped before saving the send result. Check SES before sending this email again.',
      }))
    );
    return;
  }
  await (dependencies.reserve ?? reserveEmailBatch)(db);
  const claimToken = randomUUID();
  const claimed = await db.$transaction(async tx => {
    const result = await tx.emailDeliveryBatch.updateMany({
      where: { id: batchId, status: 'QUEUED' },
      data: { status: 'PROCESSING', claimToken, claimedAt: new Date() },
    });
    if (result.count)
      await tx.eventCommunicationRecipient.updateMany({
        where: {
          id: {
            in: messages.flatMap(message =>
              message.eventRecipientId ? [message.eventRecipientId] : []
            ),
          },
          status: 'PENDING',
        },
        data: { status: 'SENDING', attemptedAt: new Date() },
      });
    return result.count;
  });
  if (!claimed) return;
  const outcomes = await Promise.all(
    messages.map(async message => {
      try {
        return await (dependencies.sendEmail ?? sendEventEmail)(message);
      } catch {
        return {
          status: 'FAILED' as const,
          providerMessageId: null,
          errorCode: 'PROVIDER_ERROR',
          errorMessage: 'Email send failed.',
        };
      }
    })
  );
  await saveBatchResults(db, { ...batch, claimToken }, messages, outcomes);
}
