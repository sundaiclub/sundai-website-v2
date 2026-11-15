import { generateKeyPairSync, createSign } from 'crypto';
import { applySesEvent, sesRecipientTags } from '@/lib/sesEvents';
import {
  isSnsUrl,
  snsStringToSign,
  verifySnsMessage,
  type SnsMessage,
} from '@/lib/snsMessages';
import { buildDeliveryStats } from '@/lib/deliveryStats';
import {
  deliveryFailureReason,
  failureExample,
} from '@/lib/deliveryFailureReasons';
import { classifyLinkClick, recordLinkClick } from '@/lib/linkClicks';
import { disableRecipientEmail } from '@/lib/messageRecipients';
import { shortenSmsLinks } from '@/lib/messageLinks';

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));

const recipientId = '0b6d7c1e-4f3a-4b2c-9d8e-1a2b3c4d5e6f';
const linkId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

function trackingDb() {
  const db: any = {
    eventCommunicationRecipient: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    weeklyEmailRecipient: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    chapterMembership: { updateMany: jest.fn() },
    event: { findMany: jest.fn().mockResolvedValue([]) },
    messageLink: {
      findUnique: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    messageShortLink: { findUnique: jest.fn(), createMany: jest.fn() },
    messageLinkClick: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((operation: any) => operation(db));
  return db;
}

describe('SES delivery events', () => {
  it('matches a Delivery event by recipient tag without replacing a failure', async () => {
    const db = trackingDb();
    await applySesEvent(
      {
        eventType: 'Delivery',
        mail: {
          messageId: 'ses-1',
          tags: {
            sundai_recipient: [
              sesRecipientTags({ eventRecipientId: recipientId })!
                .sundai_recipient,
            ],
          },
        },
        delivery: { timestamp: '2026-11-05T12:00:00.000Z' },
      },
      db
    );
    expect(db.eventCommunicationRecipient.findFirst).not.toHaveBeenCalled();
    expect(db.eventCommunicationRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: recipientId, status: { notIn: ['UNDELIVERED', 'FAILED'] } },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date('2026-11-05T12:00:00.000Z'),
      },
    });
  });

  it('records a bounce with its type for failure reports', async () => {
    const db = trackingDb();
    await applySesEvent(
      {
        eventType: 'Bounce',
        mail: { tags: { sundai_recipient: [`weekly-${recipientId}`] } },
        bounce: {
          bounceType: 'Permanent',
          bounceSubType: 'NoEmail',
          bouncedRecipients: [
            { diagnosticCode: 'smtp; 550 5.1.1 user unknown' },
          ],
        },
      },
      db
    );
    expect(db.weeklyEmailRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: recipientId },
      data: {
        status: 'UNDELIVERED',
        errorCode: 'Bounce.Permanent.NoEmail',
        errorMessage: 'smtp; 550 5.1.1 user unknown',
        deliveredAt: null,
      },
    });
  });

  it('falls back to the SES message ID and records complaints', async () => {
    const db = trackingDb();
    db.weeklyEmailRecipient.findFirst.mockResolvedValue({ id: recipientId });
    await applySesEvent(
      {
        notificationType: 'Complaint',
        mail: { messageId: 'ses-2' },
        complaint: { timestamp: '2026-11-05T13:00:00.000Z' },
      },
      db
    );
    expect(db.weeklyEmailRecipient.findFirst).toHaveBeenCalledWith({
      where: { providerMessageId: 'ses-2' },
      select: { id: true },
    });
    expect(db.weeklyEmailRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: recipientId },
      data: { complainedAt: new Date('2026-11-05T13:00:00.000Z') },
    });
    // The weekly email covers every chapter, so all chapter email turns off.
    expect(db.chapterMembership.updateMany).not.toHaveBeenCalled();
    db.weeklyEmailRecipient.findUnique.mockResolvedValue({ hackerId: 'h1' });
    await applySesEvent(
      { eventType: 'Complaint', mail: { messageId: 'ses-2' } },
      db
    );
    expect(db.chapterMembership.updateMany).toHaveBeenCalledWith({
      where: { hackerId: 'h1' },
      data: { emailNotificationsEnabled: false },
    });
  });

  it('ignores invalid tags and unsupported event types', async () => {
    const db = trackingDb();
    expect(
      await applySesEvent(
        {
          eventType: 'Delivery',
          mail: { tags: { sundai_recipient: ['event-not-a-uuid'] } },
        },
        db
      )
    ).toEqual({ matched: false });
    await applySesEvent({ eventType: 'Open', mail: { messageId: 'x' } }, db);
    expect(db.eventCommunicationRecipient.updateMany).not.toHaveBeenCalled();
  });
});

describe('SNS message verification', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  function signed(overrides: Partial<SnsMessage> = {}): SnsMessage {
    const message: SnsMessage = {
      Type: 'Notification',
      MessageId: 'sns-1',
      TopicArn: 'arn:aws:sns:us-east-2:123:ses-events',
      Message: '{"eventType":"Delivery"}',
      Timestamp: '2026-11-05T12:00:00.000Z',
      SignatureVersion: '2',
      Signature: '',
      SigningCertURL:
        'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-abc.pem',
      ...overrides,
    };
    message.Signature = createSign('RSA-SHA256')
      .update(snsStringToSign(message))
      .sign(privateKey, 'base64');
    return message;
  }

  it('accepts a correctly signed message from an SNS certificate URL', async () => {
    const getCertificate = jest.fn().mockResolvedValue(publicPem);
    expect(await verifySnsMessage(signed(), getCertificate)).toBe(true);
  });

  it('rejects a changed message or a certificate outside SNS', async () => {
    const getCertificate = jest.fn().mockResolvedValue(publicPem);
    const tampered = { ...signed(), Message: '{"eventType":"Bounce"}' };
    expect(await verifySnsMessage(tampered, getCertificate)).toBe(false);
    expect(
      await verifySnsMessage(
        signed({ SigningCertURL: 'https://attacker.example/cert.pem' }),
        getCertificate
      )
    ).toBe(false);
    expect(isSnsUrl('https://sns.us-east-2.amazonaws.com.attacker.com/x')).toBe(
      false
    );
  });
});

describe('unsubscribe', () => {
  it('turns off email for the event chapter and records the unsubscribe', async () => {
    const db = trackingDb();
    db.eventCommunicationRecipient.findUnique.mockResolvedValue({
      hackerId: 'h1',
      communication: {
        event: { chapterId: 'c1', chapter: { slug: 'boston' } },
      },
    });
    expect(
      await disableRecipientEmail(
        { kind: 'event', id: recipientId },
        'UNSUBSCRIBE',
        db
      )
    ).toEqual({ chapterSlug: 'boston' });
    expect(db.chapterMembership.updateMany).toHaveBeenCalledWith({
      where: { hackerId: 'h1', chapterId: 'c1' },
      data: { emailNotificationsEnabled: false },
    });
    expect(db.eventCommunicationRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: recipientId, unsubscribedAt: null },
      data: { unsubscribedAt: expect.any(Date) },
    });
  });

  it('does nothing for an unknown recipient', async () => {
    const db = trackingDb();
    expect(
      await disableRecipientEmail(
        { kind: 'event', id: recipientId },
        'UNSUBSCRIBE',
        db
      )
    ).toBeNull();
    expect(db.chapterMembership.updateMany).not.toHaveBeenCalled();
  });
});

describe('SMS short links', () => {
  it('replaces each URL with a unique short link per recipient', async () => {
    const db = trackingDb();
    db.messageLink.findMany.mockResolvedValue([
      { id: 'link-event', url: 'https://www.sundai.club/events/boston/build' },
    ]);
    const bodies = await shortenSmsLinks(
      db,
      'sms-1',
      'RSVP: https://www.sundai.club/events/boston/build.',
      ['r1', 'r2']
    );
    const rows = db.messageShortLink.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0].code).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(rows[0].code).not.toBe(rows[1].code);
    expect(bodies.get('r1')).toBe(
      `RSVP: https://www.sundai.club/s/${rows[0].code}.`
    );
    expect(bodies.get('r2')).toContain(rows[1].code);
  });

  it('keeps a message without links unchanged', async () => {
    const db = trackingDb();
    const bodies = await shortenSmsLinks(db, 'sms-1', 'Doors at 9.', ['r1']);
    expect(bodies.get('r1')).toBe('Doors at 9.');
    expect(db.messageShortLink.createMany).not.toHaveBeenCalled();
  });
});

describe('delivery statistics', () => {
  it('summarizes statuses, failure reasons, clicks, RSVPs, and links', () => {
    const count = (n: number) => ({ _count: { _all: n } });
    const stats = buildDeliveryStats(['a'], {
      statuses: [
        { sourceId: 'a', status: 'PENDING', ...count(1) },
        { sourceId: 'a', status: 'SENT', ...count(2) },
        { sourceId: 'a', status: 'DELIVERED', ...count(5) },
        { sourceId: 'a', status: 'UNDELIVERED', ...count(1) },
        { sourceId: 'a', status: 'FAILED', ...count(1) },
      ],
      reasons: [
        {
          sourceId: 'a',
          errorCode: '30007',
          _max: { errorMessage: null },
          ...count(1),
        },
        {
          sourceId: 'a',
          errorCode: 'MessageRejected',
          _max: {
            errorMessage: 'Email address is not verified: ada@example.com',
          },
          ...count(1),
        },
      ],
      complained: [{ sourceId: 'a', ...count(1) }],
      unsubscribed: [{ sourceId: 'a', ...count(2) }],
      clickTotals: [
        { sourceId: 'a', clicked: 3, preferenceClicks: 1, rsvps: 2 },
      ],
      links: [
        {
          sourceId: 'a',
          url: 'https://a.test/prefs',
          kind: 'PREFERENCES',
          isEventLink: false,
          clicks: 9,
          uniqueClicks: 9,
          botClicks: 0,
          rsvps: 0,
        },
        {
          sourceId: 'a',
          url: 'https://a.test/1',
          kind: 'CONTENT',
          isEventLink: false,
          clicks: 2,
          uniqueClicks: 1,
          botClicks: 4,
          rsvps: 0,
        },
        {
          sourceId: 'a',
          url: 'https://a.test/events/x',
          kind: 'CONTENT',
          isEventLink: true,
          clicks: 4,
          uniqueClicks: 3,
          botClicks: 1,
          rsvps: 2,
        },
      ],
    }).get('a')!;
    expect(stats).toMatchObject({
      total: 10,
      pending: 1,
      accepted: 2,
      delivered: 5,
      failed: 2,
      complained: 1,
      unsubscribed: 2,
      clicked: 3,
      rsvps: 2,
      hasEventLinks: true,
      preferenceClicks: 1,
      botClicks: 5,
    });
    expect(stats.failureReasons).toEqual([
      expect.objectContaining({
        code: '30007',
        label: 'Filtered by the carrier as spam',
        hint: expect.stringContaining('10DLC'),
        example: null,
      }),
      expect.objectContaining({
        code: 'MessageRejected',
        example: 'Email address is not verified: [email]',
      }),
    ]);
    expect(stats.links.map(link => [link.url, link.rsvps])).toEqual([
      ['https://a.test/events/x', 2],
      ['https://a.test/1', null],
      ['https://a.test/prefs', null],
    ]);
  });

  it('labels unknown provider codes and redacts contact details', () => {
    expect(deliveryFailureReason(null).label).toBe('Unknown reason');
    expect(deliveryFailureReason('40001')).toEqual({
      label: 'Twilio error 40001',
      hint: 'Look up https://www.twilio.com/docs/api/errors/40001',
    });
    expect(deliveryFailureReason('Bounce.Permanent.Other').label).toBe(
      'Hard bounce'
    );
    expect(failureExample('Message delivery failed.')).toBeNull();
    expect(failureExample("The 'To' number +1 (617) 555-0123 is invalid")).toBe(
      "The 'To' number [phone] is invalid"
    );
  });
});

describe('bot click filtering', () => {
  const human =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const sentAt = new Date('2026-11-05T12:00:00.000Z');

  it('flags scanners, link previews, missing agents, and instant email clicks', () => {
    const at = (seconds: number) => new Date(sentAt.getTime() + seconds * 1000);
    expect(
      classifyLinkClick({
        userAgent: human,
        channel: 'EMAIL',
        sentAt,
        clickedAt: at(60),
      })
    ).toBeNull();
    expect(
      classifyLinkClick({
        userAgent: 'facebookexternalhit/1.1 Facebot Twitterbot/1.0',
        channel: 'SMS',
        sentAt,
        clickedAt: at(60),
      })
    ).toBe('USER_AGENT');
    expect(
      classifyLinkClick({
        userAgent: null,
        channel: 'EMAIL',
        sentAt,
        clickedAt: at(60),
      })
    ).toBe('USER_AGENT');
    expect(
      classifyLinkClick({
        userAgent: human,
        channel: 'EMAIL',
        sentAt,
        clickedAt: at(3),
      })
    ).toBe('TOO_FAST');
    expect(
      classifyLinkClick({
        userAgent: human,
        channel: 'SMS',
        sentAt,
        clickedAt: at(3),
      })
    ).toBeNull();
  });
});

describe('link clicks', () => {
  const human =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15';
  const eventLink = {
    id: linkId,
    url: 'https://www.sundai.club/events/boston/build',
    eventCommunicationId: 'blast',
    weeklyEmailId: null,
    eventCommunication: { channel: 'EMAIL' },
  };

  it('records a human click and redirects only to the stored URL', async () => {
    const db = trackingDb();
    db.messageLink.findUnique.mockResolvedValue(eventLink);
    db.eventCommunicationRecipient.findFirst.mockResolvedValue({
      id: recipientId,
      attemptedAt: new Date(Date.now() - 60_000),
    });

    expect(await recordLinkClick({ linkId, recipientId }, human, db)).toBe(
      'https://www.sundai.club/events/boston/build'
    );
    expect(db.eventCommunicationRecipient.findFirst).toHaveBeenCalledWith({
      where: { id: recipientId, communicationId: 'blast' },
      select: { id: true, attemptedAt: true },
    });
    expect(db.messageLinkClick.create).toHaveBeenCalledWith({
      data: {
        linkId,
        clickedAt: expect.any(Date),
        isBot: false,
        botReason: null,
        eventRecipientId: recipientId,
      },
    });
  });

  it('marks a burst across links as a scanner, including earlier clicks', async () => {
    const db = trackingDb();
    db.messageLink.findUnique.mockResolvedValue(eventLink);
    db.eventCommunicationRecipient.findFirst.mockResolvedValue({
      id: recipientId,
      attemptedAt: new Date(Date.now() - 60_000),
    });
    db.messageLinkClick.updateMany.mockResolvedValue({ count: 2 });

    await recordLinkClick({ linkId, recipientId }, human, db);
    expect(db.messageLinkClick.updateMany).toHaveBeenCalledWith({
      where: {
        eventRecipientId: recipientId,
        isBot: false,
        linkId: { not: linkId },
        clickedAt: { gte: expect.any(Date) },
      },
      data: { isBot: true, botReason: 'BURST' },
    });
    expect(db.messageLinkClick.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isBot: true, botReason: 'BURST' }),
    });
  });

  it('resolves an SMS short code to its link and recipient', async () => {
    const db = trackingDb();
    db.messageShortLink.findUnique.mockResolvedValue({
      eventRecipientId: recipientId,
      link: { ...eventLink, eventCommunication: { channel: 'SMS' } },
    });
    db.eventCommunicationRecipient.findFirst.mockResolvedValue({
      id: recipientId,
      attemptedAt: new Date(),
    });
    expect(await recordLinkClick({ code: 'Ab3dE9xQ' }, human, db)).toBe(
      eventLink.url
    );
    expect(db.messageLinkClick.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isBot: false,
        eventRecipientId: recipientId,
      }),
    });
  });

  it('ignores forged recipients and still redirects when counting fails', async () => {
    const db = trackingDb();
    expect(
      await recordLinkClick({ linkId: 'bad', recipientId: null }, human, db)
    ).toBeNull();
    expect(await recordLinkClick({ code: '../../x' }, human, db)).toBeNull();

    db.messageLink.findUnique.mockResolvedValue({
      ...eventLink,
      eventCommunicationId: null,
      weeklyEmailId: 'weekly',
      eventCommunication: null,
    });
    await recordLinkClick({ linkId, recipientId: 'forged' }, human, db);
    expect(db.messageLinkClick.create).toHaveBeenCalledWith({
      data: {
        linkId,
        clickedAt: expect.any(Date),
        isBot: false,
        botReason: null,
      },
    });

    db.$transaction.mockRejectedValue(new Error('database unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await recordLinkClick({ linkId, recipientId: null }, human, db)
    ).toBe(eventLink.url);
  });
});

describe('sending health', () => {
  it('reports hard bounce and complaint rates with SES review levels', async () => {
    const { loadMessagingHealth } = require('@/lib/messagingHealth');
    // Event email, weekly email: accepted, delivered, hard bounces,
    // complaints. Then SMS sent and failed.
    const counts = [600, 400, 560, 380, 30, 10, 1, 0, 200, 12];
    let call = 0;
    const count = jest.fn(() => Promise.resolve(counts[call++]));
    const db = {
      eventCommunicationRecipient: { count },
      weeklyEmailRecipient: { count },
    };
    const health = await loadMessagingHealth(
      db,
      new Date('2026-11-05T00:00:00.000Z')
    );
    expect(health.email).toEqual({
      sent: 1000,
      delivered: 940,
      hardBounces: 40,
      complaints: 1,
      bounceRate: 0.04,
      complaintRate: 0.001,
      bounceLevel: 'warning',
      complaintLevel: 'critical',
    });
    expect(health.sms).toEqual({ sent: 200, failed: 12, failureRate: 0.06 });
    expect(count).toHaveBeenNthCalledWith(5, {
      where: expect.objectContaining({
        status: 'UNDELIVERED',
        errorCode: { startsWith: 'Bounce.Permanent.' },
      }),
    });
  });
});
