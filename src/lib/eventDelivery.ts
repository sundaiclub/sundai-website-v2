import type { SendEmailCommandInput } from '@aws-sdk/client-ses';

export type EventDeliveryConfig = {
  awsRegion: string | null;
  sesFromEmail: string | null;
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
};

type EventSmsInput = {
  to: string;
  body: string;
};

type RecipientDeliveryInput = {
  channel: 'EMAIL' | 'SMS';
  subject?: string | null;
  body: string;
  recipients: Array<{ recipientId: string; contactValue: string }>;
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

function environmentConfig(): EventDeliveryConfig {
  return {
    awsRegion: process.env.AWS_REGION ?? null,
    sesFromEmail: process.env.AWS_SES_FROM_EMAIL ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioMessagingServiceSid:
      process.env.TWILIO_MESSAGING_SERVICE_SID ?? null,
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
  const { SendEmailCommand, SESClient } = await import('@aws-sdk/client-ses');
  const client = new SESClient({ region: config.awsRegion! });
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
    return failedResult('PROVIDER_UNAVAILABLE', 'Email delivery is unavailable.');
  }

  const payload = {
    Destination: { ToAddresses: [input.to] },
    Message: {
      Subject: { Charset: 'UTF-8', Data: input.subject },
      Body: {
        Text: { Charset: 'UTF-8', Data: input.body },
        Html: {
          Charset: 'UTF-8',
          Data: `<p>${input.body
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('\n', '<br>')}</p>`,
        },
      },
    },
    Source: config.sesFromEmail!,
  };

  try {
    const result = await (dependencies.send ??
      (value => sendWithSes(value, config)))(payload);
    return {
      status: 'SENT',
      providerMessageId: result.MessageId ?? null,
      errorCode: null,
      errorMessage: null,
    };
  } catch {
    return failedResult();
  }
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
  const client = twilio(config.twilioAccountSid!, config.twilioAuthToken!);
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
    const result = await (dependencies.create ??
      (value => sendWithTwilio(value, config)))(payload);
    return {
      status: 'SENT',
      providerMessageId: result.sid ?? null,
      errorCode: null,
      errorMessage: null,
    };
  } catch {
    return failedResult();
  }
}

function twilioStatusCallbackUrl() {
  const base =
    process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/api/webhooks/twilio/status`;
}

export async function deliverEventRecipients(
  input: RecipientDeliveryInput,
  dependencies: {
    sendEmail?: (input: EventEmailInput) => Promise<EventDeliveryResult>;
    sendSms?: (input: EventSmsInput) => Promise<EventDeliveryResult>;
  } = {}
): Promise<RecipientDeliveryResult[]> {
  return Promise.all(
    input.recipients.map(async recipient => {
      try {
        const result =
          input.channel === 'EMAIL'
            ? await (dependencies.sendEmail ?? sendEventEmail)({
                to: recipient.contactValue,
                subject: input.subject ?? '',
                body: input.body,
              })
            : await (dependencies.sendSms ?? sendEventSms)({
                to: recipient.contactValue,
                body: input.body,
              });
        return { recipientId: recipient.recipientId, ...result };
      } catch {
        return { recipientId: recipient.recipientId, ...failedResult() };
      }
    })
  );
}
