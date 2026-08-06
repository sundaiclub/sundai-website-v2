import { notifyEventDecision } from '../../src/lib/eventDecisionNotifications';

const config = {
  appUrl: 'https://events.example.com/',
  awsRegion: 'us-east-1',
  sesFromEmail: 'Sundai Events <events@example.com>',
  twilioAccountSid: 'AC123',
  twilioAuthToken: 'secret',
  twilioMessagingServiceSid: 'MG123',
};

const buildContext = (overrides: Record<string, unknown> = {}) => ({
  publicSafeMessage: null,
  applicant: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phoneNumber: '+16175550123',
    smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
    smsConsentVersion: 'site-application-checkbox-2026-08-04',
  },
  event: {
    title: 'Boston AI Build Night',
    confirmationMessage: 'Bring your laptop and photo ID.',
    declineMessage: 'We cannot accommodate this application.',
    slug: 'ai-build-night',
    chapter: {
      id: 'chapter-boston',
      slug: 'boston',
    },
  },
  preferences: {
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
  },
  ...overrides,
});

describe('event decision notifications', () => {
  it('sends approval email and SMS through enabled channels', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const sendSms = jest.fn().mockResolvedValue(undefined);

    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'APPROVED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue(buildContext()),
        sendEmail,
        sendSms,
      }
    );

    expect(result).toEqual({ email: 'sent', sms: 'sent' });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: "You're approved for Boston AI Build Night",
        text: expect.stringContaining(
          'Your application for “Boston AI Build Night” has been approved.'
        ),
        html: expect.stringContaining('Bring your laptop and photo ID.'),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain(
      'https://events.example.com/events/boston/ai-build-night'
    );
    expect(sendSms).toHaveBeenCalledWith({
      to: '+16175550123',
      body: expect.stringContaining(
        'Your application for “Boston AI Build Night” has been approved.'
      ),
    });
  });

  it('uses the saved public decision message for a decline', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);

    await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'DECLINED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue(
          buildContext({
            publicSafeMessage: 'This session has reached its review limit.',
            preferences: {
              notificationsAllowed: true,
              emailNotificationsEnabled: true,
              smsNotificationsEnabled: false,
            },
          })
        ),
        sendEmail,
        sendSms: jest.fn(),
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Update on your application for Boston AI Build Night',
        text: expect.stringContaining(
          'This session has reached its review limit.'
        ),
      })
    );
  });

  it('honors the master notification preference', async () => {
    const sendEmail = jest.fn();
    const sendSms = jest.fn();

    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'APPROVED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue(
          buildContext({
            preferences: {
              notificationsAllowed: false,
              emailNotificationsEnabled: true,
              smsNotificationsEnabled: true,
            },
          })
        ),
        sendEmail,
        sendSms,
      }
    );

    expect(result).toEqual({ email: 'skipped', sms: 'skipped' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('requires each channel preference and a usable contact value', async () => {
    const sendEmail = jest.fn();
    const sendSms = jest.fn();

    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'DECLINED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue(
          buildContext({
            applicant: {
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              phoneNumber: '555-0123',
            },
            preferences: {
              notificationsAllowed: true,
              emailNotificationsEnabled: false,
              smsNotificationsEnabled: true,
            },
          })
        ),
        sendEmail,
        sendSms,
      }
    );

    expect(result).toEqual({ email: 'skipped', sms: 'skipped' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('reports provider failures without rejecting the decision workflow', async () => {
    const providerError = new Error('SES unavailable');
    const logError = jest.fn();

    await expect(
      notifyEventDecision(
        {
          eventId: 'event-1',
          registrationId: 'registration-1',
          status: 'APPROVED',
        },
        {
          config,
          loadContext: jest.fn().mockResolvedValue(buildContext()),
          sendEmail: jest.fn().mockRejectedValue(providerError),
          sendSms: jest.fn().mockResolvedValue(undefined),
          logError,
        }
      )
    ).resolves.toEqual({ email: 'failed', sms: 'sent' });
    expect(logError).toHaveBeenCalledWith(
      '[EVENT_DECISION_NOTIFICATION_EMAIL]',
      providerError
    );
  });

  it('does not load applicant data when neither provider is configured', async () => {
    const loadContext = jest.fn();

    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'APPROVED',
      },
      {
        config: {
          ...config,
          awsRegion: null,
          sesFromEmail: null,
          twilioAccountSid: null,
          twilioAuthToken: null,
          twilioMessagingServiceSid: null,
        },
        loadContext,
      }
    );

    expect(result).toEqual({ email: 'skipped', sms: 'skipped' });
    expect(loadContext).not.toHaveBeenCalled();
  });
});
