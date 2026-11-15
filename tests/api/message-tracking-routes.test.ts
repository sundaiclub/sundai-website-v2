jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    messageLink: { findUnique: jest.fn() },
    eventCommunicationRecipient: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/sesEvents', () => ({ applySesEvent: jest.fn() }));
jest.mock('@/lib/snsMessages', () => ({
  ...jest.requireActual('@/lib/snsMessages'),
  verifySnsMessage: jest.fn(),
}));
jest.mock('@/lib/linkClicks', () => ({
  ...jest.requireActual('@/lib/linkClicks'),
  recordLinkClick: jest.fn(),
}));
jest.mock('@/lib/messageRecipients', () => ({
  ...jest.requireActual('@/lib/messageRecipients'),
  disableRecipientEmail: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { applySesEvent } from '@/lib/sesEvents';
import { verifySnsMessage } from '@/lib/snsMessages';
import { recordLinkClick } from '@/lib/linkClicks';
import { disableRecipientEmail } from '@/lib/messageRecipients';
import { POST as receiveSesEvent } from '@/app/api/webhooks/ses/route';
import { GET as followLink, HEAD as headLink } from '@/app/l/[linkId]/route';
import { GET as followShortLink } from '@/app/s/[code]/route';
import {
  GET as openUnsubscribe,
  POST as oneClickUnsubscribe,
} from '@/app/api/email/unsubscribe/[token]/route';

const topicArn = 'arn:aws:sns:us-east-2:123:ses-events';
const linkId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const snsBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    Type: 'Notification',
    MessageId: 'sns-1',
    TopicArn: topicArn,
    Message: JSON.stringify({
      eventType: 'Delivery',
      mail: { messageId: 'm' },
    }),
    Timestamp: '2026-11-05T12:00:00.000Z',
    SignatureVersion: '2',
    Signature: 'sig',
    SigningCertURL: 'https://sns.us-east-2.amazonaws.com/cert.pem',
    ...overrides,
  });
// jsdom's Request has no text(); the route only reads the raw body.
const sesRequest = (body: string) =>
  ({ text: jest.fn().mockResolvedValue(body) }) as unknown as Request;

describe('SES event webhook', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, AWS_SES_EVENTS_TOPIC_ARN: topicArn };
    (verifySnsMessage as jest.Mock).mockResolvedValue(true);
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('saves a verified SES event from the configured topic', async () => {
    const response = await receiveSesEvent(sesRequest(snsBody()));
    expect(response.status).toBe(204);
    expect(applySesEvent).toHaveBeenCalledWith({
      eventType: 'Delivery',
      mail: { messageId: 'm' },
    });
  });

  it('rejects other topics, bad signatures, and missing configuration', async () => {
    expect(
      (await receiveSesEvent(sesRequest(snsBody({ TopicArn: 'arn:other' }))))
        .status
    ).toBe(403);
    (verifySnsMessage as jest.Mock).mockResolvedValue(false);
    expect((await receiveSesEvent(sesRequest(snsBody()))).status).toBe(403);
    delete process.env.AWS_SES_EVENTS_TOPIC_ARN;
    expect((await receiveSesEvent(sesRequest(snsBody()))).status).toBe(503);
    expect(applySesEvent).not.toHaveBeenCalled();
  });

  it('confirms a subscription only through an SNS URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await receiveSesEvent(
      sesRequest(
        snsBody({
          Type: 'SubscriptionConfirmation',
          SubscribeURL: 'https://attacker.example/confirm',
          Token: 't',
        })
      )
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('tracked email link redirect', () => {
  const context = { params: Promise.resolve({ linkId }) };
  beforeEach(() => jest.clearAllMocks());

  it('counts a GET and redirects to the stored URL', async () => {
    (recordLinkClick as jest.Mock).mockResolvedValue(
      'https://www.sundai.club/events/boston/build'
    );
    const response = await followLink(
      new Request(`https://www.sundai.club/l/${linkId}?r=recipient`),
      context
    );
    expect(recordLinkClick).toHaveBeenCalledWith(
      { linkId, recipientId: 'recipient' },
      null
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://www.sundai.club/events/boston/build'
    );
  });

  it('sends unknown links to the home page', async () => {
    (recordLinkClick as jest.Mock).mockResolvedValue(null);
    const response = await followLink(
      new Request(`https://www.sundai.club/l/${linkId}`),
      context
    );
    expect(response.headers.get('location')).toBe('https://www.sundai.club/');
  });

  it('redirects HEAD requests without counting them', async () => {
    (prisma.messageLink.findUnique as jest.Mock).mockResolvedValue({
      url: 'https://www.sundai.club/projects/1',
    });
    const response = await headLink(
      new Request(`https://www.sundai.club/l/${linkId}`, { method: 'HEAD' }),
      context
    );
    expect(response.headers.get('location')).toBe(
      'https://www.sundai.club/projects/1'
    );
    expect(recordLinkClick).not.toHaveBeenCalled();
  });
});

describe('SMS short link redirect', () => {
  it('counts the click with the visitor user agent', async () => {
    jest.clearAllMocks();
    (recordLinkClick as jest.Mock).mockResolvedValue(
      'https://www.sundai.club/events/boston/build'
    );
    const request = {
      headers: new Headers({ 'user-agent': 'Mozilla/5.0 Safari' }),
    } as unknown as Request;
    const response = await followShortLink(request, {
      params: Promise.resolve({ code: 'Ab3dE9xQ' }),
    });
    expect(recordLinkClick).toHaveBeenCalledWith(
      { code: 'Ab3dE9xQ' },
      'Mozilla/5.0 Safari'
    );
    expect(response.headers.get('location')).toBe(
      'https://www.sundai.club/events/boston/build'
    );
  });
});

describe('one-click unsubscribe', () => {
  const token = 'event-9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const context = (value: string) => ({
    params: Promise.resolve({ token: value }),
  });
  beforeEach(() => jest.clearAllMocks());

  it('turns off email on the RFC 8058 POST', async () => {
    (disableRecipientEmail as jest.Mock).mockResolvedValue({
      chapterSlug: 'boston',
    });
    const response = await oneClickUnsubscribe({} as Request, context(token));
    expect(response.status).toBe(200);
    expect(disableRecipientEmail).toHaveBeenCalledWith(
      { kind: 'event', id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' },
      'UNSUBSCRIBE'
    );
  });

  it('rejects invalid tokens', async () => {
    expect(
      (await oneClickUnsubscribe({} as Request, context('nope'))).status
    ).toBe(404);
    expect(disableRecipientEmail).not.toHaveBeenCalled();
  });

  it('never unsubscribes on GET, which link scanners send', async () => {
    (
      prisma.eventCommunicationRecipient.findUnique as jest.Mock
    ).mockResolvedValue({
      communication: { event: { chapter: { slug: 'boston' } } },
    });
    const response = await openUnsubscribe({} as Request, context(token));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://www.sundai.club/chapters/boston?tab=preferences#notification-preferences'
    );
    expect(disableRecipientEmail).not.toHaveBeenCalled();
  });
});
