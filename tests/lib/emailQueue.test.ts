import {
  createEmailBatches,
  processEmailBatch,
  publishEmailBatches,
  EmailQueueBusy,
} from '@/lib/emailQueue';
import type { PrismaClient } from '@prisma/client';

jest.mock('@vercel/queue', () => ({
  send: jest.fn().mockResolvedValue({ messageId: 'queue-id' }),
}));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));

function mockDb(batch: Record<string, unknown> = {}) {
  const db: any = {
    emailDeliveryBatch: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 'batch',
          status: 'QUEUED',
          messages: [
            {
              to: 'ada@example.com',
              subject: 'Invite',
              body: 'Join us.',
              eventRecipientId: 'recipient',
            },
          ],
          eventCommunicationId: 'blast',
          weeklyEmailId: null,
          claimToken: null,
          ...batch,
        }),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { sentCount: 1, failedCount: 0 } }),
      count: jest.fn().mockResolvedValue(0),
    },
    eventCommunicationRecipient: { updateMany: jest.fn() },
    eventCommunication: { update: jest.fn() },
    weeklyEmail: { update: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (operation: any) => operation(db));
  return db as PrismaClient & typeof db;
}

const sent = {
  status: 'SENT' as const,
  providerMessageId: 'ses-id',
  errorCode: null,
  errorMessage: null,
};

it('splits 3,001 emails into batches of at most ten without calling SES', async () => {
  const db = mockDb();
  const messages = Array.from({ length: 3001 }, (_, index) => ({
    to: `member${index}@example.com`,
    subject: 'Invite',
    body: 'Join us.',
  }));
  const ids = await createEmailBatches(db, messages, {
    eventCommunicationId: 'blast',
  });
  expect(ids).toHaveLength(301);
  const rows = db.emailDeliveryBatch.createMany.mock.calls[0][0].data;
  expect(rows.every((row: any) => row.messages.length <= 10)).toBe(true);
  expect(rows.flatMap((row: any) => row.messages)).toEqual(messages);
});

it('publishes only stable batch IDs and marks publication after queue acceptance', async () => {
  const db = mockDb();
  await publishEmailBatches(['batch'], db);
  expect(require('@vercel/queue').send).toHaveBeenCalledWith(
    'email-delivery',
    { batchId: 'batch' },
    expect.objectContaining({ idempotencyKey: 'batch', region: 'iad1' })
  );
  expect(db.emailDeliveryBatch.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'batch' } })
  );
});

it('claims before sending and saves the batch and communication result', async () => {
  const db = mockDb();
  const sendEmail = jest.fn().mockResolvedValue(sent);
  await processEmailBatch('batch', { db, sendEmail, reserve: async () => {} });
  expect(
    db.emailDeliveryBatch.updateMany.mock.invocationCallOrder[0]
  ).toBeLessThan(sendEmail.mock.invocationCallOrder[0]);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(db.eventCommunication.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT', sentCount: 1 }),
    })
  );
});

it('does not send when a competing consumer wins the atomic claim', async () => {
  const db = mockDb();
  db.emailDeliveryBatch.updateMany.mockResolvedValue({ count: 0 });
  const sendEmail = jest.fn();
  await processEmailBatch('batch', { db, sendEmail, reserve: async () => {} });
  expect(sendEmail).not.toHaveBeenCalled();
});

it('does not resend a completed batch on queue redelivery', async () => {
  const db = mockDb({ status: 'COMPLETED' });
  const sendEmail = jest.fn();
  await processEmailBatch('batch', { db, sendEmail });
  expect(sendEmail).not.toHaveBeenCalled();
});

it('waits for a live claim without sending any email', async () => {
  const db = mockDb({
    status: 'PROCESSING',
    claimedAt: new Date(),
    claimToken: 'owner',
  });
  const sendEmail = jest.fn();
  await expect(
    processEmailBatch('batch', { db, sendEmail })
  ).rejects.toBeInstanceOf(EmailQueueBusy);
  expect(sendEmail).not.toHaveBeenCalled();
});

it('records an interrupted attempt as unknown and never retries the email', async () => {
  const db = mockDb({
    status: 'PROCESSING',
    claimedAt: new Date(Date.now() - 121000),
    claimToken: 'owner',
  });
  const sendEmail = jest.fn();
  await processEmailBatch('batch', { db, sendEmail });
  expect(sendEmail).not.toHaveBeenCalled();
  expect(db.eventCommunicationRecipient.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'FAILED',
        errorCode: 'SEND_OUTCOME_UNKNOWN',
      }),
    })
  );
});

it('records provider failures once and continues the rest of the batch', async () => {
  const db = mockDb({
    messages: [
      { to: 'ada@example.com', subject: 'Invite', body: 'Join us.' },
      { to: 'grace@example.com', subject: 'Invite', body: 'Join us.' },
    ],
  });
  const sendEmail = jest
    .fn()
    .mockRejectedValueOnce(new Error('Throttled'))
    .mockResolvedValue(sent);
  await processEmailBatch('batch', { db, sendEmail, reserve: async () => {} });
  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(db.emailDeliveryBatch.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ sentCount: 1, failedCount: 1 }),
    })
  );
});
