import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';

const EMAIL_BATCH_SIZE = 10;
// Twilio limits concurrent API requests per account. Larger sends queue here.
const SMS_CONCURRENCY = 10;
const SMS_RATE_LIMIT_RETRIES = 3;
const sesClients = new Map<
  string,
  import('@aws-sdk/client-sesv2').SESv2Client
>();
const twilioClients = new Map<string, unknown>();

export type EventDeliveryConfig = {
  awsRegion: string | null;
  sesFromEmail: string | null;
  // SES publishes delivery, bounce, and complaint events for this set.
  sesConfigurationSet?: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioMessagingServiceSid: string | null;
};

export type EventDeliveryResult = {
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type EventEmailInput = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  tags?: Record<string, string>;
  headers?: Array<{ Name: string; Value: string }>;
};

type EventSmsInput = {
  to: string;
  body: string;
};

type RecipientDeliveryInput = {
  recipients: Array<{
    recipientId: string;
    contactValue: string;
    body: string;
  }>;
};

type RecipientDeliveryResult = EventDeliveryResult & { recipientId: string };

const failedResult = (
  errorCode = 'PROVIDER_ERROR',
  errorMessage = 'Message delivery failed.'
): EventDeliveryResult => ({
  status: 'FAILED',
  providerMessageId: null,
  errorCode,
  errorMessage,
});

function sesFailedResult(error: unknown): EventDeliveryResult {
  if (!error || typeof error !== 'object') {
    return failedResult('SES_PROVIDER_ERROR', 'SES delivery failed.');
  }

  const providerError = error as {
    Code?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const rawCode = [
    providerError.Code,
    providerError.code,
    providerError.name,
  ].find(value => typeof value === 'string' && value.trim());
  const errorCode =
    typeof rawCode === 'string'
      ? rawCode.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100)
      : 'SES_PROVIDER_ERROR';
  const errorMessage =
    typeof providerError.message === 'string' && providerError.message.trim()
      ? providerError.message.trim().slice(0, 1000)
      : 'SES delivery failed.';

  console.error('[EVENT_EMAIL_DELIVERY]', { errorCode, errorMessage });
  return failedResult(errorCode, errorMessage);
}

function environmentConfig(): EventDeliveryConfig {
  return {
    awsRegion: process.env.AWS_REGION ?? null,
    sesFromEmail: process.env.AWS_SES_FROM_EMAIL ?? null,
    sesConfigurationSet: process.env.AWS_SES_CONFIGURATION_SET ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? null,
  };
}

export function getEventDeliveryAvailability(
  config: EventDeliveryConfig = environmentConfig()
) {
  return {
    email: Boolean(config.awsRegion && config.sesFromEmail),
    sms: Boolean(
      config.twilioAccountSid &&
        config.twilioAuthToken &&
        config.twilioMessagingServiceSid
    ),
  };
}

async function sendWithSes(
  payload: SendEmailCommandInput,
  config: EventDeliveryConfig
) {
  const { SendEmailCommand, SESv2Client } = await import(
    '@aws-sdk/client-sesv2'
  );
  const region = config.awsRegion!;
  let client = sesClients.get(region);
  if (!client) {
    client = new SESv2Client({
      region,
      maxAttempts: 1,
      requestHandler: {
        httpsAgent: { maxSockets: EMAIL_BATCH_SIZE },
        requestTimeout: 10_000,
        throwOnRequestTimeout: true,
      },
    });
    sesClients.set(region, client);
  }
  const result = await client.send(new SendEmailCommand(payload));
  return result as { MessageId?: string };
}

export async function sendEventEmail(
  input: EventEmailInput,
  dependencies: {
    config?: EventDeliveryConfig;
    send?: (payload: SendEmailCommandInput) => Promise<{ MessageId?: string }>;
  } = {}
): Promise<EventDeliveryResult> {
  const config = dependencies.config ?? environmentConfig();
  if (!getEventDeliveryAvailability(config).email) {
    return failedResult(
      'PROVIDER_UNAVAILABLE',
      'Email delivery is unavailable.'
    );
  }

  const tags = Object.entries(input.tags ?? {});
  const payload: SendEmailCommandInput = {
    FromEmailAddress: config.sesFromEmail!,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Charset: 'UTF-8', Data: input.subject },
        Body: {
          Text: { Charset: 'UTF-8', Data: input.body },
          Html: {
            Charset: 'UTF-8',
            Data: input.html ?? plainTextEmailHtml(input.body),
          },
        },
        ...(input.headers?.length ? { Headers: input.headers } : {}),
      },
    },
    ...(config.sesConfigurationSet
      ? {
          ConfigurationSetName: config.sesConfigurationSet,
          ...(tags.length
            ? { EmailTags: tags.map(([Name, Value]) => ({ Name, Value })) }
            : {}),
        }
      : {}),
  };

  try {
    const result = await (
      dependencies.send ?? (value => sendWithSes(value, config))
    )(payload);
    return {
      status: 'SENT',
      providerMessageId: result.MessageId ?? null,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    return sesFailedResult(error);
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Plain organizer messages become simple HTML with clickable links, which
// lets SES deliver them with tracked links.
export function plainTextEmailHtml(body: string) {
  const linked = body
    .split(/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'])/g)
    .map((part, index) =>
      index % 2
        ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>`
        : escapeHtml(part)
    )
    .join('');
  return `<p>${linked.replaceAll('\n', '<br>')}</p>`;
}

// Twilio messages can include credentials or phone numbers. Keep only the
// numeric Twilio error code, which maps to a failure reason in reports.
function twilioFailedResult(error: unknown): EventDeliveryResult {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' && Number.isInteger(code)
    ? failedResult(String(code))
    : failedResult();
}

async function sendWithTwilio(
  payload: {
    to: string;
    messagingServiceSid: string;
    body: string;
    statusCallback?: string;
  },
  config: EventDeliveryConfig
) {
  const { default: twilio } = await import('twilio');
  const key = config.twilioAccountSid!;
  let client = twilioClients.get(key) as ReturnType<typeof twilio> | undefined;
  if (!client) {
    client = twilio(config.twilioAccountSid!, config.twilioAuthToken!);
    twilioClients.set(key, client);
  }
  return client.messages.create(payload);
}

export async function sendEventSms(
  input: EventSmsInput,
  dependencies: {
    config?: EventDeliveryConfig;
    create?: (payload: {
      to: string;
      messagingServiceSid: string;
      body: string;
      statusCallback?: string;
    }) => Promise<{ sid?: string }>;
  } = {}
): Promise<EventDeliveryResult> {
  const config = dependencies.config ?? environmentConfig();
  if (!getEventDeliveryAvailability(config).sms) {
    return failedResult('PROVIDER_UNAVAILABLE', 'SMS delivery is unavailable.');
  }

  const statusCallback = twilioStatusCallbackUrl();
  const payload = {
    to: input.to,
    messagingServiceSid: config.twilioMessagingServiceSid!,
    body: input.body,
    ...(statusCallback ? { statusCallback } : {}),
  };

  try {
    const result = await (
      dependencies.create ?? (value => sendWithTwilio(value, config))
    )(payload);
    return {
      status: 'SENT',
      providerMessageId: result.sid ?? null,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    return twilioFailedResult(error);
  }
}

function twilioStatusCallbackUrl() {
  const base =
    process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/api/webhooks/twilio/status`;
}

const isRateLimited = (result: EventDeliveryResult) =>
  result.errorCode === '20429';

// Sends each recipient's message with limited concurrency. A Twilio rate
// limit response (20429) means Twilio did not accept the message, so it is
// safe to try again after a short wait.
export async function deliverEventSmsRecipients(
  input: RecipientDeliveryInput,
  dependencies: {
    sendSms?: (input: EventSmsInput) => Promise<EventDeliveryResult>;
    wait?: (ms: number) => Promise<void>;
  } = {}
): Promise<RecipientDeliveryResult[]> {
  const send = dependencies.sendSms ?? sendEventSms;
  const wait =
    dependencies.wait ??
    ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const results: RecipientDeliveryResult[] = new Array(input.recipients.length);
  let next = 0;
  async function worker() {
    while (next < input.recipients.length) {
      const index = next++;
      const recipient = input.recipients[index];
      let result: EventDeliveryResult = failedResult();
      for (let attempt = 0; attempt <= SMS_RATE_LIMIT_RETRIES; attempt++) {
        if (attempt) await wait(1000 * 2 ** (attempt - 1));
        try {
          result = await send({
            to: recipient.contactValue,
            body: recipient.body,
          });
        } catch {
          result = failedResult();
        }
        if (!isRateLimited(result)) break;
      }
      results[index] = { recipientId: recipient.recipientId, ...result };
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(SMS_CONCURRENCY, input.recipients.length) },
      worker
    )
  );
  return results;
}
