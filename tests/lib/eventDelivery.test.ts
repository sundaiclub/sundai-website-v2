type DeliveryModule = typeof import('../../src/lib/eventDelivery');

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
        Source: configuredProviders.sesFromEmail,
      })
    );
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
        statusCallback:
          'https://www.sundai.club/api/webhooks/twilio/status',
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

  it('records independent recipient outcomes when one provider operation fails', async () => {
    const { deliverEventRecipients } = loadDelivery();
    const sendEmail = jest.fn(async ({ to }: { to: string }) => {
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

    const outcomes = await deliverEventRecipients(
      {
        channel: 'EMAIL',
        subject: 'Event update',
        body: 'Doors open at 9:30.',
        recipients: [
          {
            recipientId: 'recipient-ada',
            contactValue: 'ada@example.com',
          },
          {
            recipientId: 'recipient-grace',
            contactValue: 'grace@example.com',
          },
          {
            recipientId: 'recipient-linus',
            contactValue: 'linus@example.com',
          },
        ],
      },
      { sendEmail }
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
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });
});
