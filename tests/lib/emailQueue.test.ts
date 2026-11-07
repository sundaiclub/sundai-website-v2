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
      findUnique: jest.fn().mockResolvedValue({
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
    eventCommunicationRecipient: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    weeklyEmailRecipient: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    messageLink: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    event: { findMany: jest.fn().mockResolvedValue([]) },
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

it('rewrites every link per recipient, including preference links', async () => {
  const db = mockDb();
  const eventUrl = 'https://www.sundai.club/events/boston/build?ref=a&b=1';
  const preferencesUrl =
    'https://www.sundai.club/chapters/boston?tab=preferences#notification-preferences';
  db.messageLink.findMany.mockResolvedValue([
    { id: 'link-1', url: eventUrl },
    { id: 'link-2', url: preferencesUrl },
  ]);
  db.event.findMany.mockResolvedValue([
    { id: 'event-1', slug: 'build', chapter: { slug: 'boston' } },
  ]);
  const html = `<a href="https://www.sundai.club/events/boston/build?ref=a&amp;b=1">RSVP</a> <a href="${preferencesUrl}">Unsubscribe</a> <a href="mailto:team@sundai.club">Mail</a>`;
  await createEmailBatches(
    db,
    ['recipient-a', 'recipient-b'].map(id => ({
      to: `${id}@example.com`,
      subject: 'Invite',
      body: 'Join us.',
      html,
      eventRecipientId: id,
    })),
    { eventCommunicationId: 'blast' }
  );

  expect(db.messageLink.createMany).toHaveBeenCalledWith({
    data: [
      {
        eventCommunicationId: 'blast',
        url: eventUrl,
        kind: 'CONTENT',
        eventId: 'event-1',
      },
      {
        eventCommunicationId: 'blast',
        url: preferencesUrl,
        kind: 'PREFERENCES',
        eventId: null,
      },
    ],
    skipDuplicates: true,
  });
  const saved = db.emailDeliveryBatch.createMany.mock.calls[0][0].data[0]
    .messages as Array<{ html: string }>;
  expect(saved[0].html).toContain(
    'href="https://www.sundai.club/l/link-1?r=recipient-a"'
  );
  expect(saved[0].html).toContain(
    'href="https://www.sundai.club/l/link-2?r=recipient-a"'
  );
  expect(saved[1].html).toContain(
    'href="https://www.sundai.club/l/link-1?r=recipient-b"'
  );
  expect(saved[0].html).toContain('href="mailto:team@sundai.club"');
});

it('keeps original links for a test send without a source', async () => {
  const db = mockDb();
  const html = '<a href="https://www.sundai.club/projects/1">Project</a>';
  await createEmailBatches(db, [
    { to: 'admin@example.com', subject: 'Test', body: 'Body', html },
  ]);
  expect(db.messageLink.createMany).not.toHaveBeenCalled();
  expect(
    db.emailDeliveryBatch.createMany.mock.calls[0][0].data[0].messages[0].html
  ).toBe(html);
});

it('tags each SES send with its weekly recipient and saves weekly results', async () => {
  const db = mockDb({
    eventCommunicationId: null,
    weeklyEmailId: 'weekly',
    messages: [
      {
        to: 'ada@example.com',
        subject: 'News',
        body: 'Body',
        weeklyRecipientId: 'weekly-recipient',
      },
    ],
  });
  const sendEmail = jest.fn().mockResolvedValue(sent);
  await processEmailBatch('batch', { db, sendEmail, reserve: async () => {} });

  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      tags: { sundai_recipient: 'weekly-weekly-recipient' },
      headers: [
        {
          Name: 'List-Unsubscribe',
          Value:
            '<https://www.sundai.club/api/email/unsubscribe/weekly-weekly-recipient>',
        },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ],
    })
  );
  expect(db.weeklyEmailRecipient.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ['weekly-recipient'] }, status: 'PENDING' },
    data: { status: 'SENDING', attemptedAt: expect.any(Date) },
  });
  expect(db.weeklyEmailRecipient.updateMany).toHaveBeenCalledWith({
    where: { id: 'weekly-recipient', status: 'SENDING' },
    data: sent,
  });
  expect(db.eventCommunicationRecipient.updateMany).not.toHaveBeenCalled();
});

it('keeps a delivery status that SES reported before the batch result was saved', async () => {
  const db = mockDb();
  db.eventCommunicationRecipient.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  await processEmailBatch('batch', {
    db,
    sendEmail: jest.fn().mockResolvedValue(sent),
    reserve: async () => {},
  });
  expect(db.eventCommunicationRecipient.updateMany).toHaveBeenLastCalledWith({
    where: { id: 'recipient', providerMessageId: null },
    data: { providerMessageId: 'ses-id' },
  });
});
