import { NextResponse } from 'next/server';
import { communicationStats, fiveWordExcerpt } from '@/lib/adminCommunications';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ communicationId: string }> }
) {
  const params = await props.params;
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const item = await prisma.eventCommunication.findFirst({
      where: { id: params.communicationId, sentAt: { not: null } },
      select: {
        id: true,
        channel: true,
        status: true,
        subject: true,
        body: true,
        audienceType: true,
        audienceDefinitionJson: true,
        sentAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            chapter: { select: { id: true, name: true, slug: true } },
          },
        },
        sentBy: { select: { id: true, name: true, email: true } },
        recipients: {
          orderBy: [{ status: 'asc' }, { displayName: 'asc' }],
          select: {
            id: true,
            displayName: true,
            contactValue: true,
            status: true,
            providerMessageId: true,
            errorCode: true,
            errorMessage: true,
            attemptedAt: true,
            deliveredAt: true,
          },
        },
      },
    });
    if (!item) {
      return NextResponse.json(
        { message: 'Communication not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: item.id,
      channel: item.channel,
      status: item.status,
      subject: item.subject,
      body: item.body,
      excerpt: fiveWordExcerpt(item.body),
      audienceType: item.audienceType,
      audienceDefinition: item.audienceDefinitionJson,
      sentAt: item.sentAt!.toISOString(),
      createdAt: item.createdAt.toISOString(),
      chapter: item.event.chapter,
      event: { id: item.event.id, title: item.event.title },
      sentBy: item.sentBy,
      stats: communicationStats(item.recipients.map(row => row.status)),
      recipients: item.recipients.map(recipient => ({
        ...recipient,
        attemptedAt: recipient.attemptedAt?.toISOString() ?? null,
        deliveredAt: recipient.deliveredAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('[ADMIN_COMMUNICATION_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
