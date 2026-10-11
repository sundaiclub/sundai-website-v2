import {
  buildCheckInTicketContent,
  notifyEventDecision,
} from '../../src/lib/eventDecisionNotifications';
import { enqueueEmails } from '../../src/lib/emailQueue';

jest.mock('../../src/lib/emailQueue', () => ({
  enqueueEmails: jest.fn().mockResolvedValue({ queued: 1 }),
}));

const config = {
  appUrl: 'https://events.example.com/',
  awsRegion: 'us-east-1',
  sesFromEmail: 'Sundai Events <events@example.com>',
  twilioAccountSid: 'AC123',
  twilioAuthToken: 'secret',
  twilioMessagingServiceSid: 'MG123',
};

const checkInToken = '7d4f3c2a-1b0e-4a9d-8c7b-6e5f4d3c2b1a';

const buildContext = (overrides: Record<string, unknown> = {}) => ({
  publicSafeMessage: null,
  checkInToken,
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
    waitlistMessage: 'We will contact you if a spot opens.',
    declineMessage: 'We cannot accommodate this application.',
    approvedDetailsJson: {
      address: '42 Private Lane, Boston, MA',
      details: 'Use the side entrance and ask for Grace.',
    },
    trackAttendance: false,
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
    smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
    smsConsentVersion: 'site-application-checkbox-2026-08-04',
  },
  ...overrides,
});

describe('event decision notifications', () => {
  it('queues the rendered email through the shared delivery path', async () => {
    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'APPROVED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue(buildContext()),
        sendSms: jest.fn().mockResolvedValue(undefined),
      }
    );

    expect(result).toEqual({ email: 'queued', sms: 'sent' });
    expect(enqueueEmails).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ada@example.com',
        subject: "You're approved for Boston AI Build Night",
        body: expect.stringContaining('Bring your laptop and photo ID.'),
        html: expect.stringContaining('42 Private Lane, Boston, MA'),
      }),
    ]);
  });

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
    expect(sendEmail.mock.calls[0][0].text).toContain(
      'Address: 42 Private Lane, Boston, MA'
    );
    expect(sendEmail.mock.calls[0][0].text).toContain(
      'Approved-only details: Use the side entrance and ask for Grace.'
    );
    expect(sendEmail.mock.calls[0][0].html).toContain('>Address</p>');
    expect(sendEmail.mock.calls[0][0].html).toContain(
      '42 Private Lane, Boston, MA'
    );
    expect(sendEmail.mock.calls[0][0].html).toContain(
      '>Approved-only details</p>'
    );
    expect(sendEmail.mock.calls[0][0].html).toContain(
      'Use the side entrance and ask for Grace.'
    );
    expect(sendEmail.mock.calls[0][0].html).toContain('<!doctype html>');
    expect(sendEmail.mock.calls[0][0].html).toContain('SUNDAI CLUB');
    expect(sendEmail.mock.calls[0][0].html).toContain(
      'background-color:#151c3f'
    );
    expect(sendSms).toHaveBeenCalledWith({
      to: '+16175550123',
      body: [
        'Sundai: Your application for “Boston AI Build Night” has been approved.',
        'Bring your laptop and photo ID.',
        'Address: 42 Private Lane, Boston, MA',
        'Approved-only details: Use the side entrance and ask for Grace.',
        'View event:\nhttps://events.example.com/events/boston/ai-build-night',
      ].join('\n\n'),
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
              smsConsentAt: null,
              smsConsentVersion: null,
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

  it('sends the configured waitlist message through enabled channels', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const sendSms = jest.fn().mockResolvedValue(undefined);

    const result = await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'WAITLISTED',
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
        subject: "You're waitlisted for Boston AI Build Night",
        text: expect.stringContaining(
          'Your application for “Boston AI Build Night” has been waitlisted.'
        ),
        html: expect.stringContaining('We will contact you if a spot opens.'),
      })
    );
    expect(sendSms).toHaveBeenCalledWith({
      to: '+16175550123',
      body: expect.stringContaining(
        'Your application for “Boston AI Build Night” has been waitlisted.'
      ),
    });
    expect(sendEmail.mock.calls[0][0].text).not.toContain('42 Private Lane');
    expect(sendSms.mock.calls[0][0].body).not.toContain('42 Private Lane');
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

  it('leaves check-in QR codes out of approvals when attendance is not tracked', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const sendSms = jest.fn().mockResolvedValue(undefined);

    await notifyEventDecision(
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

    expect(sendEmail.mock.calls[0][0].html).not.toContain('/api/qr/check-in/');
    expect(sendEmail.mock.calls[0][0].text).not.toContain('?tab=ticket');
    expect(sendSms.mock.calls[0][0].body).not.toContain('?tab=ticket');
  });

  it('includes the check-in QR code and ticket link in tracked approvals', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const sendSms = jest.fn().mockResolvedValue(undefined);
    const context = buildContext();

    await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'APPROVED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue({
          ...context,
          event: { ...context.event, trackAttendance: true },
        }),
        sendEmail,
        sendSms,
      }
    );

    const ticketUrl =
      'https://events.example.com/events/boston/ai-build-night?tab=ticket';
    const email = sendEmail.mock.calls[0][0];
    expect(email.html).toContain(
      `src="https://events.example.com/api/qr/check-in/${checkInToken}"`
    );
    expect(email.html).toContain(`href="${ticketUrl}"`);
    expect(email.text).toContain(
      `Show your check-in QR code when you arrive: ${ticketUrl}`
    );
    expect(sendSms.mock.calls[0][0].body).toContain(
      `Your check-in QR code:\n${ticketUrl}`
    );
  });

  it('does not attach check-in codes to waitlist or decline notices', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const context = buildContext();

    await notifyEventDecision(
      {
        eventId: 'event-1',
        registrationId: 'registration-1',
        status: 'WAITLISTED',
      },
      {
        config,
        loadContext: jest.fn().mockResolvedValue({
          ...context,
          event: { ...context.event, trackAttendance: true },
        }),
        sendEmail,
        sendSms: jest.fn().mockResolvedValue(undefined),
      }
    );

    expect(sendEmail.mock.calls[0][0].html).not.toContain('/api/qr/check-in/');
  });
});

describe('buildCheckInTicketContent', () => {
  it('embeds the attendee QR code in the email and links the ticket tab in SMS', () => {
    const content = buildCheckInTicketContent(
      {
        applicantName: 'Ada Lovelace',
        checkInToken,
        event: buildContext().event,
      },
      'https://events.example.com'
    );
    const ticketUrl =
      'https://events.example.com/events/boston/ai-build-night?tab=ticket';

    expect(content.subject).toBe(
      'Your check-in QR code for Boston AI Build Night'
    );
    expect(content.text).toContain('Hi Ada Lovelace,');
    expect(content.html).toContain(
      `src="https://events.example.com/api/qr/check-in/${checkInToken}"`
    );
    expect(content.html).toContain('42 Private Lane, Boston, MA');
    expect(content.sms).toBe(
      [
        'Sundai: Check-in is now enabled for “Boston AI Build Night”.',
        'Show your check-in QR code to an organizer when you arrive.',
        `Your check-in QR code:\n${ticketUrl}`,
      ].join('\n\n')
    );
  });
});
