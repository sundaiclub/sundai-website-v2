import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  finalizeEventCommunication,
  fingerprintEventCommunicationAudience,
  resolveEventCommunicationAudience,
  snapshotEventCommunicationAudience,
} from '@/lib/eventCommunications';
import { deliverEventRecipients } from '@/lib/eventDelivery';

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

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: params.eventId },
      select: {
        id: true,
        hackerId: true,
        status: true,
        cancelledAt: true,
        hacker: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });
    const hackerIds = registrations.map(row => row.hackerId);
    const [memberships, activeBans] = await Promise.all([
      prisma.chapterMembership.findMany({
        where: {
          chapterId: access.event!.chapterId,
          hackerId: { in: hackerIds },
        },
        select: {
          hackerId: true,
          status: true,
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: true,
          smsConsentAt: true,
          smsConsentVersion: true,
        },
      }),
      prisma.userBan.findMany({
        where: { hackerId: { in: hackerIds }, revokedAt: null },
        select: { hackerId: true },
      }),
    ]);
    const membershipByHacker = new Map(
      memberships.map(membership => [membership.hackerId, membership])
    );
    const bannedHackerIds = new Set(activeBans.map(ban => ban.hackerId));
    const definition = communication.audienceDefinitionJson as {
      hackerIds?: unknown;
    } | null;
    const selectedHackerIds = Array.isArray(definition?.hackerIds)
      ? definition.hackerIds.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];
    const audience = resolveEventCommunicationAudience({
      registrations: registrations.map(registration => ({
        ...registration,
        hacker: {
          ...registration.hacker,
          isGloballyBanned: bannedHackerIds.has(registration.hackerId),
        },
        membership: membershipByHacker.get(registration.hackerId) ?? null,
      })),
      audienceType: communication.audienceType,
      selectedHackerIds,
      channel: communication.channel,
      smsConsentVersion: process.env.SMS_CONSENT_VERSION,
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

    const outcomes = await deliverEventRecipients({
      channel: communication.channel,
      subject: communication.subject,
      body: communication.body,
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
