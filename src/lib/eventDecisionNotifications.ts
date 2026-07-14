import prisma from '@/lib/prisma';
import { DEFAULT_EVENT_MESSAGES } from '@/lib/eventMessageDefaults';

export type EventDecisionNotificationStatus = 'APPROVED' | 'DECLINED';
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
  };
  event: {
    title: string;
    confirmationMessage: string | null;
    declineMessage: string | null;
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

function isE164PhoneNumber(value: string | null): value is string {
  return Boolean(value && /^\+[1-9]\d{7,14}$/.test(value));
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
  const approved = status === 'APPROVED';
  const statusLabel = approved ? 'approved' : 'declined';
  const configuredMessage =
    context.publicSafeMessage ??
    (approved
      ? context.event.confirmationMessage
      : context.event.declineMessage);
  const publicMessage =
    configuredMessage?.trim() ||
    (approved
      ? DEFAULT_EVENT_MESSAGES.confirmation
      : DEFAULT_EVENT_MESSAGES.decline);
  const eventUrl = `${normalizeAppUrl(appUrl)}/events/${encodeURIComponent(
    context.event.chapter.slug
  )}/${encodeURIComponent(context.event.slug)}`;
  const statusSentence = `Your application for “${context.event.title}” has been ${statusLabel}.`;
  const subject = approved
    ? `You're approved for ${context.event.title}`
    : `Update on your application for ${context.event.title}`;
  const text = `Hi ${context.applicant.name},\n\n${statusSentence}\n\n${publicMessage}\n\nView event: ${eventUrl}\n\nSundai`;
  const html = [
    `<p>Hi ${escapeHtml(context.applicant.name)},</p>`,
    `<p>${escapeHtml(statusSentence)}</p>`,
    `<p>${escapeHtml(publicMessage).replaceAll('\n', '<br>')}</p>`,
    `<p><a href="${escapeHtml(eventUrl)}">View event</a></p>`,
    '<p>Sundai</p>',
  ].join('');
  const sms = `Sundai: ${statusSentence} ${publicMessage} ${eventUrl}`;

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
        },
      },
      event: {
        select: {
          title: true,
          confirmationMessage: true,
          declineMessage: true,
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

    if (!context?.preferences?.notificationsAllowed) return skippedResult();

    const content = buildDecisionContent(context, input.status, config.appUrl);
    const result = skippedResult();
    const deliveries: Promise<void>[] = [];
    const channels: Array<'email' | 'sms'> = [];

    if (
      emailConfigured &&
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
      context.preferences.smsNotificationsEnabled &&
      isE164PhoneNumber(context.applicant.phoneNumber)
    ) {
      channels.push('sms');
      deliveries.push(
        (dependencies.sendSms ?? (sms => sendSmsWithTwilio(sms, config)))({
          to: context.applicant.phoneNumber,
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
