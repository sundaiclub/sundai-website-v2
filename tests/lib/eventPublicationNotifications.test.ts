import { resolvePublicationNotificationRecipients } from '../../src/lib/eventPublicationNotifications';

describe('event publication notifications', () => {
  it('uses each active member preference and includes both enabled channels', () => {
    const recipients = resolvePublicationNotificationRecipients([
      {
        hackerId: 'both',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
        smsConsentVersion: 'v2',
        hacker: {
          email: 'both@example.com',
          phoneNumber: '+16175550101',
          smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
          smsConsentVersion: 'site-application-checkbox-2026-08-04',
        },
      },
      {
        hackerId: 'disabled',
        notificationsAllowed: false,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
        smsConsentVersion: 'v2',
        hacker: {
          email: 'disabled@example.com',
          phoneNumber: '+16175550102',
          smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
          smsConsentVersion: 'site-application-checkbox-2026-08-04',
        },
      },
      {
        hackerId: 'email-only',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        smsConsentAt: null,
        smsConsentVersion: null,
        hacker: {
          email: 'email@example.com',
          phoneNumber: '+16175550103',
          smsConsentAt: null,
          smsConsentVersion: null,
        },
      },
      {
        hackerId: 'old-sms-consent',
        notificationsAllowed: true,
        emailNotificationsEnabled: false,
        smsNotificationsEnabled: true,
        smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
        smsConsentVersion: 'v1',
        hacker: {
          email: null,
          phoneNumber: '+16175550104',
          smsConsentAt: new Date('2026-07-01T00:00:00.000Z'),
          smsConsentVersion: 'v1',
        },
      },
    ]);

    expect(recipients).toEqual([
      {
        hackerId: 'both',
        channel: 'EMAIL',
        contactValue: 'both@example.com',
      },
      {
        hackerId: 'both',
        channel: 'SMS',
        contactValue: '+16175550101',
      },
      {
        hackerId: 'email-only',
        channel: 'EMAIL',
        contactValue: 'email@example.com',
      },
    ]);
  });
});
