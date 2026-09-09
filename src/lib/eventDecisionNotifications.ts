import prisma from '@/lib/prisma';
import { sanitizeApprovedDetailsJson } from '@/lib/approvedEventDetails';
import { DEFAULT_EVENT_MESSAGES } from '@/lib/eventMessageDefaults';
import { normalizeSmsPhoneNumber } from '@/lib/phoneNumbers';
import { SMS_CONSENT_CONFIGURED, SMS_CONSENT_VERSION } from '@/lib/smsConsent';

export type EventDecisionNotificationStatus =
  | 'APPROVED'
  | 'WAITLISTED'
  | 'DECLINED';
export type EventDecisionNotificationChannelResult =
  | 'sent'
  | 'skipped'
  | 'failed';

export type EventDecisionNotificationResult = {
  email: EventDecisionNotificationChannelResult;
  sms: EventDecisionNotificationChannelResult;
};

type EventDecisionNotificationContext = {
  publicSafeMessage: string | null;
  applicant: {
    name: string;
    email: string | null;
    phoneNumber: string | null;
    smsConsentAt: Date | null;
    smsConsentVersion: string | null;
  };
  event: {
    title: string;
    confirmationMessage: string | null;
    waitlistMessage: string | null;
    declineMessage: string | null;
    approvedDetailsJson?: unknown;
    slug: string;
    chapter: {
      id: string;
      slug: string;
    };
  };
  preferences: {
    notificationsAllowed: boolean;
    emailNotificationsEnabled: boolean;
    smsNotificationsEnabled: boolean;
    smsConsentAt: Date | null;
    smsConsentVersion: string | null;
  } | null;
};

type EmailNotification = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SmsNotification = {
  to: string;
  body: string;
};

type EventDecisionNotificationConfig = {
  appUrl: string;
  awsRegion: string | null;
  sesFromEmail: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioMessagingServiceSid: string | null;
};

export type EventDecisionNotificationDependencies = {
  config?: EventDecisionNotificationConfig;
  loadContext?: (
    eventId: string,
    registrationId: string
  ) => Promise<EventDecisionNotificationContext | null>;
  sendEmail?: (notification: EmailNotification) => Promise<void>;
  sendSms?: (notification: SmsNotification) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
};

const skippedResult = (): EventDecisionNotificationResult => ({
  email: 'skipped',
  sms: 'skipped',
});

function getConfig(): EventDecisionNotificationConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sundai.club',
    awsRegion: process.env.AWS_REGION ?? null,
    sesFromEmail: process.env.AWS_SES_FROM_EMAIL ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? null,
  };
}

function isEmailConfigured(config: EventDecisionNotificationConfig): boolean {
  return Boolean(config.awsRegion && config.sesFromEmail);
}

function isSmsConfigured(config: EventDecisionNotificationConfig): boolean {
  return Boolean(
    config.twilioAccountSid &&
      config.twilioAuthToken &&
      config.twilioMessagingServiceSid
  );
}

function isSendableEmail(value: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeAppUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApprovedDetailKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function humanizeApprovedDetailKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getApprovedDetails(
  value: unknown
): { address: string | null; details: Array<[string, string]> } {
  const sanitized = sanitizeApprovedDetailsJson(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return { address: null, details: [] };
  }

  let address: string | null = null;
  const details: Array<[string, string]> = [];

  Object.entries(sanitized).forEach(([key, rawValue]) => {
    const normalizedKey = normalizeApprovedDetailKey(key);
    if (typeof rawValue !== 'string' || !rawValue.trim()) return;

    const detailValue = rawValue.trim();
    if (normalizedKey === 'address') {
      address = detailValue;
      return;
    }

    details.push([
      normalizedKey === 'details'
        ? 'Approved-only details'
        : humanizeApprovedDetailKey(key),
      detailValue,
    ]);
  });

  return { address, details };
}

function buildDecisionHtml(input: {
  applicantName: string;
  eventTitle: string;
  eventUrl: string;
  publicMessage: string;
  status: EventDecisionNotificationStatus;
  statusSentence: string;
  approvedDetails: {
    address: string | null;
    details: Array<[string, string]>;
  };
  appUrl: string;
}): string {
  const brandImageUrl = `${normalizeAppUrl(input.appUrl)}/images/sundai-social-card.png`;
  const statusLabel = {
    APPROVED: 'Application approved',
    WAITLISTED: 'Application waitlisted',
    DECLINED: 'Application update',
  }[input.status];
  const approvedDetailRows = [
    ...(input.approvedDetails.address
      ? [['Address', input.approvedDetails.address] as [string, string]]
      : []),
    ...input.approvedDetails.details,
  ];
  const approvedDetailsHtml =
    approvedDetailRows.length > 0
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;background-color:#0e1020;border:1px solid #30385f">
          <tr>
            <td style="padding:22px 24px">
              ${approvedDetailRows
                .map(
                  ([label, value]) =>
                    `<p style="margin:0 0 8px;color:#f7b44f;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(label)}</p><p style="margin:0 0 20px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.65">${escapeHtml(value).replaceAll('\n', '<br>')}</p>`
                )
                .join('')}
            </td>
          </tr>
        </table>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(input.eventTitle)}</title>
  <style>
    @media only screen and (max-width: 640px) {
      .email-shell { width: 100% !important; }
      .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .event-title { font-size: 30px !important; }
      .hero-image { height: auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#08090d;color:#ffffff">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.statusSentence)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#08090d">
    <tr>
      <td align="center" style="padding:0 12px 40px">
        <table role="presentation" class="email-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px">
          <tr>
            <td style="height:8px;background-color:#8fa7df"></td>
            <td style="height:8px;background-color:#b48bca"></td>
            <td style="height:8px;background-color:#e268a9"></td>
            <td style="height:8px;background-color:#f58b76"></td>
            <td style="height:8px;background-color:#f7b44f"></td>
          </tr>
          <tr>
            <td colspan="5" class="email-padding" style="padding:26px 32px 22px;background-color:#08090d;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;letter-spacing:2px;color:#ffffff">SUNDAI CLUB</td>
          </tr>
          <tr>
            <td colspan="5" style="background-color:#000000;border:1px solid #25283a;border-bottom:0">
              <img class="hero-image" src="${escapeHtml(brandImageUrl)}" width="638" alt="Sundai Club" style="display:block;width:100%;max-width:638px;height:auto;border:0">
            </td>
          </tr>
          <tr>
            <td colspan="5" class="email-padding" style="padding:38px 42px 42px;background-color:#151c3f;border:1px solid #30385f;border-top:0">
              <p style="margin:0 0 14px;font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f7b44f">// ${escapeHtml(statusLabel)}</p>
              <h1 class="event-title" style="margin:0 0 26px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:40px;line-height:1.15;letter-spacing:-1px">${escapeHtml(input.eventTitle)}</h1>
              <div style="height:2px;margin:0 0 26px;background-color:#e268a9;background-image:linear-gradient(90deg,#8fa7df,#e268a9,#f7b44f)"></div>
              <p style="margin:0 0 18px;color:#e5e7eb;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.7">Hi ${escapeHtml(input.applicantName)},</p>
              <p style="margin:0 0 18px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;line-height:1.6">${escapeHtml(input.statusSentence)}</p>
              <p style="margin:0;color:#e5e7eb;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.7">${escapeHtml(input.publicMessage).replaceAll('\n', '<br>')}</p>
              ${approvedDetailsHtml}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px">
                <tr>
                  <td align="center" bgcolor="#f7b44f" style="border:2px solid #08090d">
                    <a href="${escapeHtml(input.eventUrl)}" style="display:inline-block;padding:15px 24px;color:#151c3f;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:.5px;text-decoration:none">VIEW EVENT →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="5" align="center" style="padding:24px 16px;color:#6b7280;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:1px">SUNDAI CLUB · COMMUNITY BUILDS TOGETHER</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildDecisionContent(
  context: EventDecisionNotificationContext,
  status: EventDecisionNotificationStatus,
  appUrl: string
): {
  subject: string;
  text: string;
  html: string;
  sms: string;
} {
  const statusLabel = {
    APPROVED: 'approved',
    WAITLISTED: 'waitlisted',
    DECLINED: 'declined',
  }[status];
  const eventMessage = {
    APPROVED: context.event.confirmationMessage,
    WAITLISTED: context.event.waitlistMessage,
    DECLINED: context.event.declineMessage,
  }[status];
  const defaultMessage = {
    APPROVED: DEFAULT_EVENT_MESSAGES.confirmation,
    WAITLISTED: DEFAULT_EVENT_MESSAGES.waitlist,
    DECLINED: DEFAULT_EVENT_MESSAGES.decline,
  }[status];
  const configuredMessage =
    context.publicSafeMessage ?? eventMessage;
  const publicMessage = configuredMessage?.trim() || defaultMessage;
  const eventUrl = `${normalizeAppUrl(appUrl)}/events/${encodeURIComponent(
    context.event.chapter.slug
  )}/${encodeURIComponent(context.event.slug)}`;
  const statusSentence = `Your application for “${context.event.title}” has been ${statusLabel}.`;
  const subject =
    status === 'APPROVED'
      ? `You're approved for ${context.event.title}`
      : status === 'WAITLISTED'
        ? `You're waitlisted for ${context.event.title}`
        : `Update on your application for ${context.event.title}`;
  const approvedDetails =
    status === 'APPROVED'
      ? getApprovedDetails(context.event.approvedDetailsJson)
      : { address: null, details: [] };
  const approvedDetailLines = [
    ...(approvedDetails.address
      ? [`Address: ${approvedDetails.address}`]
      : []),
    ...approvedDetails.details.map(([label, value]) => `${label}: ${value}`),
  ];
  const approvedDetailsText =
    approvedDetailLines.length > 0
      ? `\n\n${approvedDetailLines.join('\n\n')}`
      : '';
  const text = `Hi ${context.applicant.name},\n\n${statusSentence}\n\n${publicMessage}${approvedDetailsText}\n\nView event: ${eventUrl}\n\nSundai`;
  const html = buildDecisionHtml({
    applicantName: context.applicant.name,
    eventTitle: context.event.title,
    eventUrl,
    publicMessage,
    status,
    statusSentence,
    approvedDetails,
    appUrl,
  });
  const smsSections = [
    `Sundai: ${statusSentence}`,
    publicMessage,
    ...approvedDetailLines,
    `View event:\n${eventUrl}`,
  ];
  const sms = smsSections.join('\n\n');

  return { subject, text, html, sms };
}

async function loadContext(
  eventId: string,
  registrationId: string
): Promise<EventDecisionNotificationContext | null> {
  const registration = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId },
    select: {
      publicSafeMessage: true,
      hacker: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          smsConsentAt: true,
          smsConsentVersion: true,
        },
      },
      event: {
        select: {
          title: true,
          confirmationMessage: true,
          waitlistMessage: true,
          declineMessage: true,
          approvedDetailsJson: true,
          slug: true,
          chapter: {
            select: { id: true, slug: true },
          },
        },
      },
    },
  });

  if (!registration) return null;

  const preferences = await prisma.chapterMembership.findFirst({
    where: {
      chapterId: registration.event.chapter.id,
      hackerId: registration.hacker.id,
      status: 'ACTIVE',
    },
    select: {
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      smsConsentAt: true,
      smsConsentVersion: true,
    },
  });

  return {
    publicSafeMessage: registration.publicSafeMessage,
    applicant: registration.hacker,
    event: registration.event,
    preferences,
  };
}

async function sendEmailWithSes(
  notification: EmailNotification,
  config: EventDecisionNotificationConfig
): Promise<void> {
  const { SendEmailCommand, SESClient } = await import('@aws-sdk/client-ses');
  const client = new SESClient({ region: config.awsRegion! });
  await client.send(
    new SendEmailCommand({
      Destination: { ToAddresses: [notification.to] },
      Message: {
        Subject: { Charset: 'UTF-8', Data: notification.subject },
        Body: {
          Text: { Charset: 'UTF-8', Data: notification.text },
          Html: { Charset: 'UTF-8', Data: notification.html },
        },
      },
      Source: config.sesFromEmail!,
    })
  );
}

async function sendSmsWithTwilio(
  notification: SmsNotification,
  config: EventDecisionNotificationConfig
): Promise<void> {
  const { default: twilio } = await import('twilio');
  const client = twilio(config.twilioAccountSid!, config.twilioAuthToken!);
  await client.messages.create({
    to: notification.to,
    messagingServiceSid: config.twilioMessagingServiceSid!,
    body: notification.body,
    ...((process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL)
      ? {
          statusCallback: `${(
            process.env.TWILIO_WEBHOOK_BASE_URL ??
            process.env.NEXT_PUBLIC_APP_URL!
          ).replace(/\/$/, '')}/api/webhooks/twilio/status`,
        }
      : {}),
  });
}

export async function notifyEventDecision(
  input: {
    eventId: string;
    registrationId: string;
    status: EventDecisionNotificationStatus;
  },
  dependencies: EventDecisionNotificationDependencies = {}
): Promise<EventDecisionNotificationResult> {
  const config = dependencies.config ?? getConfig();
  const emailConfigured = isEmailConfigured(config);
  const smsConfigured = isSmsConfigured(config);

  if (!emailConfigured && !smsConfigured) return skippedResult();

  const logError =
    dependencies.logError ??
    ((message: string, error: unknown) => console.error(message, error));

  try {
    const context = await (dependencies.loadContext ?? loadContext)(
      input.eventId,
      input.registrationId
    );

    if (!context) return skippedResult();

    const content = buildDecisionContent(context, input.status, config.appUrl);
    const smsPhoneNumber = normalizeSmsPhoneNumber(
      context.applicant.phoneNumber
    );
    const result = skippedResult();
    const deliveries: Promise<void>[] = [];
    const channels: Array<'email' | 'sms'> = [];

    if (
      emailConfigured &&
      context.preferences?.notificationsAllowed &&
      context.preferences.emailNotificationsEnabled &&
      isSendableEmail(context.applicant.email)
    ) {
      channels.push('email');
      deliveries.push(
        (dependencies.sendEmail ?? (email => sendEmailWithSes(email, config)))({
          to: context.applicant.email,
          subject: content.subject,
          text: content.text,
          html: content.html,
        })
      );
    }

    if (
      smsConfigured &&
      SMS_CONSENT_CONFIGURED &&
      context.preferences?.notificationsAllowed === true &&
      context.preferences.smsNotificationsEnabled === true &&
      context.preferences.smsConsentAt &&
      context.preferences.smsConsentVersion === SMS_CONSENT_VERSION &&
      smsPhoneNumber
    ) {
      channels.push('sms');
      deliveries.push(
        (dependencies.sendSms ?? (sms => sendSmsWithTwilio(sms, config)))({
          to: smsPhoneNumber,
          body: content.sms,
        })
      );
    }

    const settled = await Promise.allSettled(deliveries);
    settled.forEach((delivery, index) => {
      const channel = channels[index];
      if (delivery.status === 'fulfilled') {
        result[channel] = 'sent';
      } else {
        result[channel] = 'failed';
        logError(
          `[EVENT_DECISION_NOTIFICATION_${channel.toUpperCase()}]`,
          delivery.reason
        );
      }
    });

    return result;
  } catch (error) {
    logError('[EVENT_DECISION_NOTIFICATION]', error);
    return {
      email: emailConfigured ? 'failed' : 'skipped',
      sms: smsConfigured ? 'failed' : 'skipped',
    };
  }
}
