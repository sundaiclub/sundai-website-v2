type DeliveryModule = typeof import('../../src/lib/eventDelivery');

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'shared-client-message' }),
  })),
  SendEmailCommand: jest.fn().mockImplementation(input => ({ input })),
}));

function loadDelivery(): DeliveryModule {
  try {
    return require('../../src/lib/eventDelivery') as DeliveryModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected event delivery adapter: ${message}`);
  }
}

const configuredProviders = {
  awsRegion: 'us-east-1',
  sesFromEmail: 'Sundai Events <events@example.com>',
  twilioAccountSid: 'AC123',
  twilioAuthToken: 'twilio-secret',
  twilioMessagingServiceSid: 'MG123',
};

describe('event delivery provider adapters', () => {
  it('reuses one SES client for concurrent sends and disables SDK retries', async () => {
    const { sendEventEmail } = loadDelivery();
    const { SESv2Client: SESClient } = require('@aws-sdk/client-sesv2');
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        sendEventEmail(
          {
            to: `member${index}@example.com`,
            subject: 'Invite',
            body: 'Join us.',
          },
          { config: configuredProviders }
        )
      )
    );

    expect(SESClient).toHaveBeenCalledTimes(1);
    expect(SESClient).toHaveBeenCalledWith({
      region: configuredProviders.awsRegion,
      maxAttempts: 1,
      requestHandler: {
        httpsAgent: { maxSockets: 10 },
        requestTimeout: 10_000,
        throwOnRequestTimeout: true,
      },
    });
    expect(SESClient.mock.results[0].value.send).toHaveBeenCalledTimes(20);
  });

  it('reports SES and Twilio availability only when each provider is fully configured', () => {
    const { getEventDeliveryAvailability } = loadDelivery();

    expect(getEventDeliveryAvailability(configuredProviders)).toEqual({
      email: true,
      sms: true,
    });
    expect(
      getEventDeliveryAvailability({
        ...configuredProviders,
        sesFromEmail: null,
        twilioAuthToken: null,
      })
    ).toEqual({ email: false, sms: false });
  });

  it('normalizes a successful SES send without exposing provider internals', async () => {
    const { sendEventEmail } = loadDelivery();
    const send = jest.fn().mockResolvedValue({ MessageId: 'ses-message-123' });

    const result = await sendEventEmail(
      {
        to: 'ada@example.com',
        subject: 'Tomorrow’s build night',
        body: 'Doors open at 9:30.',
      },
      { config: configuredProviders, send }
    );

    expect(result).toEqual({
      status: 'SENT',
      providerMessageId: 'ses-message-123',
      errorCode: null,
      errorMessage: null,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        Destination: { ToAddresses: ['ada@example.com'] },
        FromEmailAddress: configuredProviders.sesFromEmail,
      })
    );
  });

  it('uses supplied formatted HTML for an event invitation email', async () => {
    const { sendEventEmail } = loadDelivery();
    const send = jest.fn().mockResolvedValue({ MessageId: 'ses-invite' });

    await sendEventEmail(
      {
        to: 'ada@example.com',
        subject: 'You are invited',
        body: 'Plain-text invitation',
        html: '<html><body><a href="https://example.com/preferences">Unsubscribe</a></body></html>',
      },
      { config: configuredProviders, send }
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        Content: {
          Simple: expect.objectContaining({
            Body: expect.objectContaining({
              Html: expect.objectContaining({
                Data: expect.stringContaining('Unsubscribe'),
              }),
              Text: expect.objectContaining({ Data: 'Plain-text invitation' }),
            }),
          }),
        },
      })
    );
  });

  it('publishes SES events through the configuration set with the recipient tag', async () => {
    const { sendEventEmail } = loadDelivery();
    const send = jest.fn().mockResolvedValue({ MessageId: 'ses-tagged' });

    await sendEventEmail(
      {
        to: 'ada@example.com',
        subject: 'Update',
        body: 'Body',
        tags: { sundai_recipient: 'event-recipient-id' },
      },
      {
        config: { ...configuredProviders, sesConfigurationSet: 'events' },
        send,
      }
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        ConfigurationSetName: 'events',
        EmailTags: [{ Name: 'sundai_recipient', Value: 'event-recipient-id' }],
      })
    );
  });

  it('adds one-click unsubscribe headers to bulk email', async () => {
    const { sendEventEmail } = loadDelivery();
    const send = jest.fn().mockResolvedValue({ MessageId: 'ses-bulk' });
    const headers = [
      { Name: 'List-Unsubscribe', Value: '<https://www.sundai.club/u>' },
      { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
    ];

    await sendEventEmail(
      { to: 'ada@example.com', subject: 'News', body: 'Body', headers },
      { config: configuredProviders, send }
    );

    expect(send.mock.calls[0][0].Content.Simple.Headers).toEqual(headers);
  });

  it('omits SES tags when no configuration set is configured', async () => {
    const { sendEventEmail } = loadDelivery();
    const send = jest.fn().mockResolvedValue({ MessageId: 'ses-plain' });

    await sendEventEmail(
      {
        to: 'ada@example.com',
        subject: 'Update',
        body: 'Body',
        tags: { sundai_recipient: 'event-recipient-id' },
      },
      { config: configuredProviders, send }
    );

    expect(send.mock.calls[0][0]).not.toHaveProperty('ConfigurationSetName');
    expect(send.mock.calls[0][0]).not.toHaveProperty('EmailTags');
  });

  it('turns plain message URLs into escaped links', () => {
    const { plainTextEmailHtml } = loadDelivery();
    expect(
      plainTextEmailHtml('RSVP: https://sundai.club/e?a=1&b=2.\n<b>Thanks</b>')
    ).toBe(
      '<p>RSVP: <a href="https://sundai.club/e?a=1&amp;b=2">https://sundai.club/e?a=1&amp;b=2</a>.<br>&lt;b&gt;Thanks&lt;/b&gt;</p>'
    );
  });

  it('saves the SES error code and message when SES rejects a message', async () => {
    const { sendEventEmail } = loadDelivery();
    const providerError = Object.assign(
      new Error(
        'Email address is not verified in region US-EAST-2: ada@example.com'
      ),
      { name: 'MessageRejected', Code: 'MessageRejected' }
    );

    const result = await sendEventEmail(
      {
        to: 'ada@example.com',
        subject: 'Event update',
        body: 'Doors open at 9:30.',
      },
      {
        config: configuredProviders,
        send: jest.fn().mockRejectedValue(providerError),
      }
    );

    expect(result).toEqual({
      status: 'FAILED',
      providerMessageId: null,
      errorCode: 'MessageRejected',
      errorMessage:
        'Email address is not verified in region US-EAST-2: ada@example.com',
    });
  });

  it('normalizes a successful Twilio send through the configured messaging service', async () => {
    const { sendEventSms } = loadDelivery();
    const create = jest.fn().mockResolvedValue({ sid: 'SM-message-123' });

    const result = await sendEventSms(
      { to: '+16175550123', body: 'Doors open at 9:30.' },
      { config: configuredProviders, create }
    );

    expect(result).toEqual({
      status: 'SENT',
      providerMessageId: 'SM-message-123',
      errorCode: null,
      errorMessage: null,
    });
    expect(create).toHaveBeenCalledWith({
      to: '+16175550123',
      messagingServiceSid: configuredProviders.twilioMessagingServiceSid,
      body: 'Doors open at 9:30.',
    });
  });

  it('adds the public delivery status callback to an SMS send', async () => {
    const previousBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
    process.env.TWILIO_WEBHOOK_BASE_URL = 'https://www.sundai.club/';
    const { sendEventSms } = loadDelivery();
    const create = jest.fn().mockResolvedValue({ sid: 'SM-message-456' });

    try {
      await sendEventSms(
        { to: '+16175550123', body: 'Doors open at 9:30.' },
        { config: configuredProviders, create }
      );

      expect(create).toHaveBeenCalledWith({
        to: '+16175550123',
        messagingServiceSid: configuredProviders.twilioMessagingServiceSid,
        body: 'Doors open at 9:30.',
        statusCallback: 'https://www.sundai.club/api/webhooks/twilio/status',
      });
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.TWILIO_WEBHOOK_BASE_URL;
      } else {
        process.env.TWILIO_WEBHOOK_BASE_URL = previousBaseUrl;
      }
    }
  });

  it('returns a sanitized failure without persisting credentials or raw provider errors', async () => {
    const { sendEventSms } = loadDelivery();
    const rawError = new Error(
      `Twilio auth ${configuredProviders.twilioAuthToken} failed for +16175550123`
    ) as Error & { code?: string };
    rawError.code = 'TWILIO_20003';

    const result = await sendEventSms(
      { to: '+16175550123', body: 'Event update' },
      {
        config: configuredProviders,
        create: jest.fn().mockRejectedValue(rawError),
      }
    );

    expect(result).toEqual({
      status: 'FAILED',
      providerMessageId: null,
      errorCode: 'PROVIDER_ERROR',
      errorMessage: 'Message delivery failed.',
    });
    expect(JSON.stringify(result)).not.toContain(
      configuredProviders.twilioAuthToken
    );
    expect(JSON.stringify(result)).not.toContain('+16175550123');
    expect(JSON.stringify(result)).not.toContain('TWILIO_20003');
  });

  it('keeps only the numeric Twilio error code for failure reports', async () => {
    const { sendEventSms } = loadDelivery();
    const rawError = new Error(
      `The 'To' number +16175550123 is not a valid phone number.`
    ) as Error & { code?: number };
    rawError.code = 21211;

    const result = await sendEventSms(
      { to: '+16175550123', body: 'Event update' },
      {
        config: configuredProviders,
        create: jest.fn().mockRejectedValue(rawError),
      }
    );

    expect(result).toEqual({
      status: 'FAILED',
      providerMessageId: null,
      errorCode: '21211',
      errorMessage: 'Message delivery failed.',
    });
  });

  it('records independent recipient outcomes when one provider operation fails', async () => {
    const { deliverEventSmsRecipients } = loadDelivery();
    const sendSms = jest.fn(async ({ to }: { to: string }) => {
      if (to === 'grace@example.com') {
        return {
          status: 'FAILED' as const,
          providerMessageId: null,
          errorCode: 'PROVIDER_ERROR',
          errorMessage: 'Message delivery failed.',
        };
      }
      return {
        status: 'SENT' as const,
        providerMessageId: `ses-${to}`,
        errorCode: null,
        errorMessage: null,
      };
    });

    const outcomes = await deliverEventSmsRecipients(
      {
        recipients: ['ada', 'grace', 'linus'].map(name => ({
          recipientId: `recipient-${name}`,
          contactValue: `${name}@example.com`,
          body: 'Doors open at 9:30.',
        })),
      },
      { sendSms }
    );

    expect(outcomes).toEqual([
      expect.objectContaining({
        recipientId: 'recipient-ada',
        status: 'SENT',
      }),
      expect.objectContaining({
        recipientId: 'recipient-grace',
        status: 'FAILED',
        errorMessage: 'Message delivery failed.',
      }),
      expect.objectContaining({
        recipientId: 'recipient-linus',
        status: 'SENT',
      }),
    ]);
    expect(sendSms).toHaveBeenCalledTimes(3);
  });
});

describe('SMS delivery throttling', () => {
  it('limits concurrent Twilio requests and retries rate-limited sends', async () => {
    const { deliverEventSmsRecipients } = loadDelivery();
    let active = 0;
    let maxActive = 0;
    const attempts = new Map<string, number>();
    const sendSms = jest.fn(
      async ({ to, body }: { to: string; body: string }) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 1));
        active--;
        const attempt = (attempts.get(to) ?? 0) + 1;
        attempts.set(to, attempt);
        if (to === '+10000000001' && attempt < 3)
          return {
            status: 'FAILED' as const,
            providerMessageId: null,
            errorCode: '20429',
            errorMessage: 'Message delivery failed.',
          };
        return {
          status: 'SENT' as const,
          providerMessageId: `SM-${to}-${body}`,
          errorCode: null,
          errorMessage: null,
        };
      }
    );
    const wait = jest.fn().mockResolvedValue(undefined);

    const outcomes = await deliverEventSmsRecipients(
      {
        recipients: Array.from({ length: 30 }, (_, index) => ({
          recipientId: `r${index}`,
          contactValue: `+1${String(index).padStart(10, '0')}`,
          body: `b${index}`,
        })),
      },
      { sendSms, wait }
    );

    expect(maxActive).toBeLessThanOrEqual(10);
    expect(outcomes).toHaveLength(30);
    expect(outcomes.every(outcome => outcome.status === 'SENT')).toBe(true);
    expect(outcomes[1]).toMatchObject({
      recipientId: 'r1',
      providerMessageId: 'SM-+10000000001-b1',
    });
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
