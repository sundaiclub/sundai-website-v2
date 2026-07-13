import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventCommunicationsManager } from '@/lib/eventManagementApi';
import { validateEventCommunicationDraft } from '@/lib/eventCommunications';

const DEFAULT_RECIPIENT_PAGE_SIZE = 50;
const MAX_RECIPIENT_PAGE_SIZE = 100;

function recipientPageSize(value: string | null) {
  if (!value) return DEFAULT_RECIPIENT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_RECIPIENT_PAGE_SIZE);
}

async function findCommunication(eventId: string, blastId: string) {
  const communication = await prisma.eventCommunication.findUnique({
    where: { id: blastId },
  });
  return communication?.eventId === eventId ? communication : null;
}

export async function GET(
  request: Request,
  { params }: { params: { eventId: string; blastId: string } }
) {
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    const communication = await findCommunication(
      params.eventId,
      params.blastId
    );
    if (!communication) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const limit = recipientPageSize(url.searchParams.get('limit'));
    if (limit === null) {
      return NextResponse.json(
        { error: 'limit must be a positive integer.' },
        { status: 400 }
      );
    }
    const cursor = url.searchParams.get('cursor');
    const rows = await prisma.eventCommunicationRecipient.findMany({
      where: { communicationId: communication.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        communicationId: true,
        hackerId: true,
        registrationId: true,
        contactValue: true,
        displayName: true,
        status: true,
        providerMessageId: true,
        errorCode: true,
        errorMessage: true,
        attemptedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const hasMore = rows.length > limit;
    const recipients = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ...communication,
      audienceDefinition: communication.audienceDefinitionJson,
      recipients,
      recipientNextCursor: hasMore ? (recipients.at(-1)?.id ?? null) : null,
    });
  } catch (error) {
    console.error('[EVENT_COMMUNICATION_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { eventId: string; blastId: string } }
) {
  try {
    const access = await requireEventCommunicationsManager(params.eventId);
    if (access.response) return access.response;

    const current = await findCommunication(params.eventId, params.blastId);
    if (!current) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    if (current.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Sent communications are immutable.' },
        { status: 409 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }
    const allowedFields = [
      'channel',
      'subject',
      'body',
      'audienceType',
      'audienceDefinition',
    ];
    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
      return NextResponse.json(
        { error: 'Draft update contains immutable fields.' },
        { status: 400 }
      );
    }

    const channel = body.channel ?? current.channel;
    const subject = body.subject !== undefined ? body.subject : current.subject;
    const messageBody = body.body ?? current.body;
    const audienceType = body.audienceType ?? current.audienceType;
    const audienceDefinition =
      body.audienceDefinition ?? current.audienceDefinitionJson;
    const validation = validateEventCommunicationDraft({
      channel,
      subject,
      body: messageBody,
      audienceType,
      audienceDefinition,
    });
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Communication draft is invalid.', fields: validation.errors },
        { status: 400 }
      );
    }

    const updated = await prisma.eventCommunication.update({
      where: { id: current.id },
      data: {
        channel: channel as 'EMAIL' | 'SMS',
        subject: channel === 'EMAIL' ? String(subject).trim() : null,
        body: String(messageBody).trim(),
        audienceType: audienceType as
          | 'ACTIVE_REGISTERED'
          | 'PENDING'
          | 'APPROVED'
          | 'WAITLISTED'
          | 'DECLINED'
          | 'SELECTED',
        audienceDefinitionJson: audienceDefinition as object,
        previewFingerprint: null,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[EVENT_COMMUNICATION_PATCH]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
