import {
  parseEventLocationConfig,
  snapshotEventLocationNames,
  validateEventLocationAudience,
} from '@/lib/eventLocations';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  getEventCommunicationProviderAvailability,
  validateEventCommunicationDraft,
} from '@/lib/eventCommunications';
import { parsePageNumber, parsePageSize } from '@/lib/pagination';
import { loadEventCommunicationHistory } from '@/lib/communicationHistory';
import { isUuid } from '@/lib/messageRecipients';

const HISTORY_PAGE_SIZE = 20;
const MAX_HISTORY_PAGE_SIZE = 50;

export async function GET(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    const url = new URL(request.url);
    const limit = parsePageSize(
      url.searchParams.get('limit'),
      HISTORY_PAGE_SIZE,
      MAX_HISTORY_PAGE_SIZE
    );
    if (limit === null) {
      return NextResponse.json(
        { error: 'limit must be a positive integer.' },
        { status: 400 }
      );
    }
    const page = parsePageNumber(url.searchParams.get('page'));
    if (page === null) {
      return NextResponse.json(
        { error: 'page must be a positive integer.' },
        { status: 400 }
      );
    }
    const [history, chapterInvitationStatus] = await Promise.all([
      loadEventCommunicationHistory(params.eventId, page, limit),
      prisma.eventCommunication.findFirst({
        where: {
          eventId: params.eventId,
          audienceType: 'CHAPTER_MEMBERS',
          status: { not: 'DRAFT' },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          channel: true,
          status: true,
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          sentAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      items: history.groups,
      page,
      hasMore: history.hasMore,
      locations:
        parseEventLocationConfig(
          access.event!.communicationLocationsJson
        )?.locations.map(({ id, name }) => ({ id, name })) ?? [],
      chapterInvitationStatus,
      providerAvailability: getEventCommunicationProviderAvailability(),
    });
  } catch (error) {
    console.error('[EVENT_COMMUNICATIONS_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }

    const validation = validateEventCommunicationDraft({
      channel: body.channel,
      audienceType: body.audienceType,
      subject: body.subject,
      body: body.body,
      audienceDefinition: body.audienceDefinition,
    });
    const locationError = validateEventLocationAudience(
      body.audienceDefinition,
      body.audienceType,
      parseEventLocationConfig(access.event!.communicationLocationsJson)
    );
    if (locationError)
      return NextResponse.json({ error: locationError }, { status: 400 });
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Communication draft is invalid.', fields: validation.errors },
        { status: 400 }
      );
    }
    if (
      body.audienceType === 'CHAPTER_MEMBERS' &&
      access.event!.status !== 'PUBLISHED'
    ) {
      return NextResponse.json(
        { error: 'Publish the event before inviting chapter members.' },
        { status: 409 }
      );
    }

    if (body.sendGroupId !== undefined && !isUuid(body.sendGroupId)) {
      return NextResponse.json(
        { error: 'sendGroupId must be a UUID.' },
        { status: 400 }
      );
    }
    if (body.sendGroupId) {
      // A send group holds one message per channel for a single event.
      const conflict = await prisma.eventCommunication.findFirst({
        where: {
          sendGroupId: body.sendGroupId,
          OR: [
            { eventId: { not: params.eventId } },
            { channel: body.channel as 'EMAIL' | 'SMS' },
          ],
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: 'sendGroupId is already used for this channel.' },
          { status: 409 }
        );
      }
    }

    const providers = getEventCommunicationProviderAvailability();
    const selectedProvider =
      body.channel === 'EMAIL' ? providers.email : providers.sms;
    if (!selectedProvider.available) {
      return NextResponse.json(
        {
          error: 'Communication channel is unavailable.',
          reason: selectedProvider.reason,
        },
        { status: 409 }
      );
    }

    const draft = await prisma.eventCommunication.create({
      data: {
        eventId: params.eventId,
        createdById: access.hacker!.id,
        channel: body.channel as 'EMAIL' | 'SMS',
        ...(isUuid(body.sendGroupId) ? { sendGroupId: body.sendGroupId } : {}),
        status: 'DRAFT',
        subject: body.channel === 'EMAIL' ? String(body.subject).trim() : null,
        body: String(body.body).trim(),
        audienceType: body.audienceType as
          | 'ACTIVE_REGISTERED'
          | 'CHAPTER_MEMBERS'
          | 'PENDING'
          | 'APPROVED'
          | 'WAITLISTED'
          | 'DECLINED'
          | 'SELECTED',
        audienceDefinitionJson: snapshotEventLocationNames(
          body.audienceDefinition,
          parseEventLocationConfig(access.event!.communicationLocationsJson)
        ),
      },
      select: {
        id: true,
        eventId: true,
        createdById: true,
        sentById: true,
        channel: true,
        sendGroupId: true,
        status: true,
        subject: true,
        body: true,
        audienceType: true,
        audienceDefinitionJson: true,
        previewFingerprint: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error('[EVENT_COMMUNICATIONS_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
