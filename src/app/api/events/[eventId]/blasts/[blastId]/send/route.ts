import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  finalizeEventCommunication,
  fingerprintEventCommunicationAudience,
  resolveCurrentEventCommunicationAudience,
  snapshotEventCommunicationAudience,
} from '@/lib/eventCommunications';
import { deliverEventRecipients } from '@/lib/eventDelivery';
import { chapterEventInvitationDelivery } from '@/lib/chapterEventInvitations';

export async function POST(
  request: Request,
  { params }: { params: { eventId: string; blastId: string } }
) {
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    const communication = await prisma.eventCommunication.findUnique({
      where: { id: params.blastId, eventId: params.eventId },
    });
    if (!communication) {
      return NextResponse.json(
        { error: 'Communication not found.' },
        { status: 404 }
      );
    }
    if (communication.status !== 'DRAFT') {
      return NextResponse.json(communication);
    }
    if (
      communication.audienceType === 'CHAPTER_MEMBERS' &&
      access.event!.status !== 'PUBLISHED'
    ) {
      return NextResponse.json(
        { error: 'Publish the event before inviting chapter members.' },
        { status: 409 }
      );
    }

    let body: { previewFingerprint?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }
    if (
      typeof body.previewFingerprint !== 'string' ||
      !body.previewFingerprint
    ) {
      return NextResponse.json(
        { error: 'previewFingerprint is required.' },
        { status: 400 }
      );
    }

    const audience = await resolveCurrentEventCommunicationAudience({
      eventId: params.eventId,
      chapterId: access.event!.chapterId,
      audienceType: communication.audienceType,
      audienceDefinition: communication.audienceDefinitionJson,
      channel: communication.channel,
    });
    const currentFingerprint = fingerprintEventCommunicationAudience({
      channel: communication.channel,
      audienceType: communication.audienceType,
      recipients: audience.recipients,
    });
    const preview = {
      channel: communication.channel,
      eligibleCount: audience.recipients.length,
      exclusions: audience.exclusions,
      previewFingerprint: currentFingerprint,
    };

    if (body.previewFingerprint !== currentFingerprint) {
      return NextResponse.json(
        { error: 'Audience changed; review and reconfirm.', preview },
        { status: 409 }
      );
    }

    const snapshot = await snapshotEventCommunicationAudience({
      communicationId: communication.id,
      senderId: access.hacker!.id,
      audience,
      previewFingerprint: currentFingerprint,
    });
    if (!snapshot) {
      throw new Error('Communication snapshot could not be created.');
    }

    let deliveryBody = communication.body;
    let emailHtml: string | undefined;
    if (communication.audienceType === 'CHAPTER_MEMBERS') {
      const chapter = await prisma.chapter.findUnique({
        where: { id: access.event!.chapterId },
        select: { name: true, slug: true },
      });
      if (!chapter) throw new Error('Event chapter not found.');
      const invitation = chapterEventInvitationDelivery(
        { ...access.event!, chapter },
        communication.body
      );
      deliveryBody =
        communication.channel === 'EMAIL' ? invitation.text : invitation.sms;
      emailHtml = invitation.html;
    }

    const outcomes = await deliverEventRecipients({
      channel: communication.channel,
      subject: communication.subject,
      body: deliveryBody,
      emailHtml,
      recipients: snapshot.recipients.map(
        (recipient: { id: string; contactValue: string }) => ({
          recipientId: recipient.id,
          contactValue: recipient.contactValue,
        })
      ),
    });
    const finalized = await finalizeEventCommunication({
      communicationId: communication.id,
      outcomes,
    });
    return NextResponse.json(finalized);
  } catch (error) {
    console.error('[EVENT_COMMUNICATION_SEND_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
