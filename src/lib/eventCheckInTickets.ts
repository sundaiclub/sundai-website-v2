import type { EventCommunicationChannel } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  fingerprintEventCommunicationAudience,
  finalizeEventCommunication,
  resolveCurrentEventCommunicationAudience,
  snapshotEventCommunicationAudience,
} from '@/lib/eventCommunications';
import {
  deliverEventSmsRecipients,
  getEventDeliveryAvailability,
} from '@/lib/eventDelivery';
import { publishEmailBatches } from '@/lib/emailQueue';
import { buildCheckInTicketContent } from '@/lib/eventDecisionNotifications';
import { hasCheckInWindowEnded } from '@/lib/eventCheckIn';

const TICKET_AUDIENCE_DEFINITION = {
  statuses: ['APPROVED'],
  purpose: 'CHECK_IN_TICKETS',
};

/**
 * Sends every approved attendee their check-in QR code through the event
 * communications path, so the send is recorded in the Communications history,
 * honors the same notification preferences, and queues email in the background.
 */
export async function sendCheckInTickets(input: {
  eventId: string;
  actorId: string;
  now?: Date;
}): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      chapterId: true,
      startTime: true,
      endTime: true,
      approvedDetailsJson: true,
      chapter: { select: { slug: true } },
    },
  });
  if (!event || hasCheckInWindowEnded(event, input.now)) return;

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId: event.id, status: 'APPROVED', cancelledAt: null },
    select: { id: true, checkInToken: true },
  });
  if (registrations.length === 0) return;
  const tokenByRegistration = new Map(
    registrations.map(registration => [
      registration.id,
      registration.checkInToken,
    ])
  );
  // The SMS links to the shared ticket tab, so every attendee gets one body.
  const smsContent = buildCheckInTicketContent({
    applicantName: '',
    checkInToken: registrations[0].checkInToken,
    event,
  });

  const availability = getEventDeliveryAvailability();
  const channels: EventCommunicationChannel[] = [
    ...(availability.email ? (['EMAIL'] as const) : []),
    ...(availability.sms ? (['SMS'] as const) : []),
  ];

  for (const channel of channels) {
    try {
      const audience = await resolveCurrentEventCommunicationAudience({
        eventId: event.id,
        chapterId: event.chapterId,
        audienceType: 'APPROVED',
        audienceDefinition: TICKET_AUDIENCE_DEFINITION,
        channel,
      });
      if (audience.recipients.length === 0) continue;

      const communication = await prisma.eventCommunication.create({
        data: {
          eventId: event.id,
          createdById: input.actorId,
          channel,
          subject: channel === 'EMAIL' ? smsContent.subject : null,
          body: smsContent.sms,
          audienceType: 'APPROVED',
          audienceDefinitionJson: TICKET_AUDIENCE_DEFINITION,
        },
        select: { id: true },
      });
      const snapshot = await snapshotEventCommunicationAudience({
        communicationId: communication.id,
        senderId: input.actorId,
        audience,
        previewFingerprint: fingerprintEventCommunicationAudience({
          channel,
          audienceType: 'APPROVED',
          recipients: audience.recipients,
        }),
        ...(channel === 'EMAIL' && {
          emailContent: recipient => {
            const content = buildCheckInTicketContent({
              applicantName: recipient.displayName,
              checkInToken: tokenByRegistration.get(recipient.registrationId!)!,
              event,
            });
            return {
              subject: content.subject,
              body: content.text,
              html: content.html,
            };
          },
        }),
      });
      if (!snapshot) continue;

      if (channel === 'EMAIL') {
        const batches = await prisma.emailDeliveryBatch.findMany({
          where: { eventCommunicationId: communication.id, status: 'QUEUED' },
          select: { id: true },
        });
        await publishEmailBatches(batches.map(batch => batch.id));
        continue;
      }

      const outcomes = await deliverEventSmsRecipients({
        body: smsContent.sms,
        recipients: snapshot.recipients.map(recipient => ({
          recipientId: recipient.id,
          contactValue: recipient.contactValue,
        })),
      });
      await finalizeEventCommunication({
        communicationId: communication.id,
        outcomes,
      });
    } catch (error) {
      console.error(`[CHECK_IN_TICKETS_${channel}]`, error);
    }
  }
}
