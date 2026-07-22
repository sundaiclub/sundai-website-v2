import prisma from '@/lib/prisma';
import {
  deliverEventRecipients,
  type EventDeliveryResult,
} from '@/lib/eventDelivery';

type PublicationEvent = {
  id: string;
  title: string;
  slug: string;
  startTime: Date;
  publicLocation: string | null;
  chapterId: string;
  chapter: { name: string; slug: string; timezone: string };
};

type PublicationRecipient = {
  hackerId: string;
  channel: 'EMAIL' | 'SMS';
  contactValue: string;
};

function usableEmail(value: string | null) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function usableE164(value: string | null) {
  return !!value && /^\+[1-9]\d{7,14}$/.test(value);
}

export function resolvePublicationNotificationRecipients(
  memberships: Array<{
    hackerId: string;
    notificationsAllowed: boolean;
    emailNotificationsEnabled: boolean;
    smsNotificationsEnabled: boolean;
    smsConsentAt: Date | null;
    smsConsentVersion: string | null;
    hacker: { email: string | null; phoneNumber: string | null };
  }>,
  smsConsentVersion: string | undefined
): PublicationRecipient[] {
  const recipients: PublicationRecipient[] = [];

  for (const membership of memberships) {
    if (!membership.notificationsAllowed) continue;
    if (
      membership.emailNotificationsEnabled &&
      usableEmail(membership.hacker.email)
    ) {
      recipients.push({
        hackerId: membership.hackerId,
        channel: 'EMAIL',
        contactValue: membership.hacker.email!,
      });
    }
    if (
      membership.smsNotificationsEnabled &&
      usableE164(membership.hacker.phoneNumber) &&
      smsConsentVersion &&
      membership.smsConsentAt &&
      membership.smsConsentVersion === smsConsentVersion
    ) {
      recipients.push({
        hackerId: membership.hackerId,
        channel: 'SMS',
        contactValue: membership.hacker.phoneNumber!,
      });
    }
  }

  return recipients.sort((left, right) =>
    `${left.hackerId}:${left.channel}`.localeCompare(
      `${right.hackerId}:${right.channel}`
    )
  );
}

function notificationCopy(event: PublicationEvent) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sundai.club')
    .replace(/\/$/, '');
  const eventUrl = `${appUrl}/events/${event.chapter.slug}/${event.slug}`;
  const schedule = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.chapter.timezone,
  }).format(event.startTime);
  const location = event.publicLocation
    ? `\nLocation: ${event.publicLocation}`
    : '';
  const body = `${event.title} is now available from ${event.chapter.name}.\n\nWhen: ${schedule}${location}\n\nView event: ${eventUrl}`;

  return { subject: `New ${event.chapter.name} event: ${event.title}`, body };
}

function finalStatus(outcomes: EventDeliveryResult[]) {
  const sentCount = outcomes.filter(outcome => outcome.status === 'SENT').length;
  const failedCount = outcomes.length - sentCount;
  const status =
    failedCount === 0 ? 'SENT' : sentCount === 0 ? 'FAILED' : 'PARTIAL';
  return { sentCount, failedCount, status } as const;
}

export async function notifyChapterMembersOfPublishedEvent({
  event,
  requestedById,
}: {
  event: PublicationEvent;
  requestedById: string;
}) {
  const memberships = await prisma.chapterMembership.findMany({
    where: {
      chapterId: event.chapterId,
      status: 'ACTIVE',
      notificationsAllowed: true,
      hacker: { userBans: { none: { revokedAt: null } } },
    },
    select: {
      hackerId: true,
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      smsConsentAt: true,
      smsConsentVersion: true,
      hacker: { select: { email: true, phoneNumber: true } },
    },
  });
  const recipients = resolvePublicationNotificationRecipients(
    memberships,
    process.env.SMS_CONSENT_VERSION
  );

  let notification;
  try {
    notification = await prisma.eventPublicationNotification.create({
      data: {
        eventId: event.id,
        requestedById,
        recipientCount: recipients.length,
        emailRecipientCount: recipients.filter(row => row.channel === 'EMAIL')
          .length,
        smsRecipientCount: recipients.filter(row => row.channel === 'SMS')
          .length,
        recipients: {
          create: recipients.map(recipient => ({ ...recipient })),
        },
      },
      include: { recipients: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    return prisma.eventPublicationNotification.findUnique({
      where: { eventId: event.id },
    });
  }

  const copy = notificationCopy(event);
  const deliveryRows = (channel: 'EMAIL' | 'SMS') =>
    notification.recipients
      .filter(recipient => recipient.channel === channel)
      .map(recipient => ({
        recipientId: recipient.id,
        contactValue: recipient.contactValue,
      }));
  const [emailOutcomes, smsOutcomes] = await Promise.all([
    deliverEventRecipients({
      channel: 'EMAIL',
      subject: copy.subject,
      body: copy.body,
      recipients: deliveryRows('EMAIL'),
    }),
    deliverEventRecipients({
      channel: 'SMS',
      body: copy.body,
      recipients: deliveryRows('SMS'),
    }),
  ]);
  const outcomes = [...emailOutcomes, ...smsOutcomes];
  const aggregate = finalStatus(outcomes);
  const now = new Date();

  return prisma.$transaction(async tx => {
    for (const outcome of outcomes) {
      await tx.eventPublicationNotificationRecipient.update({
        where: { id: outcome.recipientId },
        data: {
          status: outcome.status,
          providerMessageId: outcome.providerMessageId,
          errorCode: outcome.errorCode,
          errorMessage: outcome.errorMessage,
          attemptedAt: now,
          deliveredAt: outcome.status === 'SENT' ? now : null,
        },
      });
    }
    return tx.eventPublicationNotification.update({
      where: { id: notification.id },
      data: { ...aggregate, sentAt: now },
    });
  });
}
