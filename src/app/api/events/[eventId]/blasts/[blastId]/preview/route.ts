import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  fingerprintEventCommunicationAudience,
  resolveCurrentEventCommunicationAudience,
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

    const resolution = await resolveCurrentEventCommunicationAudience({
      eventId: params.eventId,
      chapterId: access.event!.chapterId,
      audienceType: communication.audienceType,
      audienceDefinition: communication.audienceDefinitionJson,
      channel: communication.channel,
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
