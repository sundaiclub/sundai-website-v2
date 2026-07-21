import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import {
  getEventCommunicationProviderAvailability,
  validateEventCommunicationDraft,
} from '@/lib/eventCommunications';
import { parsePageSize } from '@/lib/pagination';

const HISTORY_PAGE_SIZE = 20;
const MAX_HISTORY_PAGE_SIZE = 50;

export async function GET(
  request: Request,
  { params }: { params: { eventId: string } }
) {
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
    const cursor = url.searchParams.get('cursor');
    const rows = await prisma.eventCommunication.findMany({
      where: { eventId: params.eventId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        eventId: true,
        channel: true,
        status: true,
        subject: true,
        body: true,
        audienceType: true,
        audienceDefinitionJson: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        sentBy: { select: { id: true, name: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
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
  { params }: { params: { eventId: string } }
) {
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
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Communication draft is invalid.', fields: validation.errors },
        { status: 400 }
      );
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
        status: 'DRAFT',
        subject: body.channel === 'EMAIL' ? String(body.subject).trim() : null,
        body: String(body.body).trim(),
        audienceType: body.audienceType as
          | 'ACTIVE_REGISTERED'
          | 'PENDING'
          | 'APPROVED'
          | 'WAITLISTED'
          | 'DECLINED'
          | 'SELECTED',
        audienceDefinitionJson: (body.audienceDefinition ?? {}) as object,
      },
      select: {
        id: true,
        eventId: true,
        createdById: true,
        sentById: true,
        channel: true,
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
