import type { EventCommunicationRecipientStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { verifyTwilioWebhook } from '@/lib/twilioWebhooks';

const STATUS_MAP: Record<string, EventCommunicationRecipientStatus> = {
  accepted: 'SENDING',
  queued: 'SENDING',
  sending: 'SENDING',
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'DELIVERED',
  undelivered: 'UNDELIVERED',
  failed: 'FAILED',
};

const STATUS_RANK: Record<EventCommunicationRecipientStatus, number> = {
  PENDING: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  UNDELIVERED: 3,
  FAILED: 3,
};

function communicationAggregate(
  statuses: EventCommunicationRecipientStatus[]
) {
  const sentCount = statuses.filter(status =>
    ['SENT', 'DELIVERED'].includes(status)
  ).length;
  const failedCount = statuses.filter(status =>
    ['FAILED', 'UNDELIVERED'].includes(status)
  ).length;
  const isPending = statuses.some(status =>
    ['PENDING', 'SENDING'].includes(status)
  );
  const status = isPending
    ? 'SENDING'
    : failedCount === 0
      ? 'SENT'
      : sentCount === 0
        ? 'FAILED'
        : 'PARTIAL';
  return { sentCount, failedCount, status } as const;
}

export async function POST(request: Request) {
  const verified = await verifyTwilioWebhook(request);
  if (!verified.ok) {
    return new Response(verified.message, { status: verified.status });
  }

  const providerMessageId =
    verified.params.get('MessageSid') ?? verified.params.get('SmsSid');
  const nextStatus = STATUS_MAP[
    (
      verified.params.get('MessageStatus') ??
      verified.params.get('SmsStatus') ??
      ''
    ).toLowerCase()
  ];
  if (!providerMessageId || !nextStatus) return new Response(null, { status: 204 });

  await prisma.$transaction(async tx => {
    const recipient = await tx.eventCommunicationRecipient.findFirst({
      where: { providerMessageId },
      select: { id: true, communicationId: true, status: true },
    });
    if (recipient) {
      if (STATUS_RANK[nextStatus] >= STATUS_RANK[recipient.status]) {
        await tx.eventCommunicationRecipient.update({
          where: { id: recipient.id },
          data: {
            status: nextStatus,
            errorCode: verified.params.get('ErrorCode'),
            deliveredAt: nextStatus === 'DELIVERED' ? new Date() : undefined,
          },
        });
      }
      const rows = await tx.eventCommunicationRecipient.findMany({
        where: { communicationId: recipient.communicationId },
        select: { status: true },
      });
      await tx.eventCommunication.update({
        where: { id: recipient.communicationId },
        data: communicationAggregate(rows.map(row => row.status)),
      });
      return;
    }

    const publicationRecipient =
      await tx.eventPublicationNotificationRecipient.findFirst({
        where: { providerMessageId },
        select: { id: true, notificationId: true, status: true },
      });
    if (!publicationRecipient) return;
    if (
      STATUS_RANK[nextStatus] >= STATUS_RANK[publicationRecipient.status]
    ) {
      await tx.eventPublicationNotificationRecipient.update({
        where: { id: publicationRecipient.id },
        data: {
          status: nextStatus,
          errorCode: verified.params.get('ErrorCode'),
          deliveredAt: nextStatus === 'DELIVERED' ? new Date() : undefined,
        },
      });
    }
    const rows = await tx.eventPublicationNotificationRecipient.findMany({
      where: { notificationId: publicationRecipient.notificationId },
      select: { status: true },
    });
    await tx.eventPublicationNotification.update({
      where: { id: publicationRecipient.notificationId },
      data: communicationAggregate(rows.map(row => row.status)),
    });
  });

  return new Response(null, { status: 204 });
}
