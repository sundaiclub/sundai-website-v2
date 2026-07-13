import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  fingerprintEventCommunicationAudience,
  resolveEventCommunicationAudience,
} from '@/lib/eventCommunications';

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: { eventId: string; blastId: string };
  }
) {
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    const communication = await prisma.eventCommunication.findUnique({
      where: { id: params.blastId, eventId: params.eventId },
      select: {
        id: true,
        status: true,
        channel: true,
        audienceType: true,
        audienceDefinitionJson: true,
      },
    });
    if (!communication) {
      return NextResponse.json(
        { error: 'Communication not found.' },
        { status: 404 }
      );
    }
    if (communication.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft communications can be previewed.' },
        { status: 409 }
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
    const hackerIds = registrations.map(registration => registration.hackerId);
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
    const audienceDefinition = communication.audienceDefinitionJson as {
      hackerIds?: unknown;
    } | null;
    const selectedHackerIds = Array.isArray(audienceDefinition?.hackerIds)
      ? audienceDefinition.hackerIds.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];

    const resolution = resolveEventCommunicationAudience({
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
    const previewFingerprint = fingerprintEventCommunicationAudience({
      channel: communication.channel,
      audienceType: communication.audienceType,
      recipients: resolution.recipients,
    });

    return NextResponse.json({
      channel: communication.channel,
      eligibleCount: resolution.recipients.length,
      exclusions: resolution.exclusions,
      previewFingerprint,
    });
  } catch (error) {
    console.error('[EVENT_COMMUNICATION_PREVIEW_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
