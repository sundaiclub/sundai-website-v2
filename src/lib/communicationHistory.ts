import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { eventCommunicationDeliveryStats } from '@/lib/deliveryStats';
import type { DeliveryStats } from '@/types/delivery-stats';

export const communicationHistorySelect = {
  id: true,
  eventId: true,
  sendGroupId: true,
  channel: true,
  status: true,
  subject: true,
  body: true,
  audienceType: true,
  audienceDefinitionJson: true,
  recipientCount: true,
  sentAt: true,
  createdAt: true,
  sentBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.EventCommunicationSelect;

type HistoryRow = Prisma.EventCommunicationGetPayload<{
  select: typeof communicationHistorySelect;
}>;

const CHANNEL_ORDER = { EMAIL: 0, SMS: 1 } as const;

export function historyItem(row: HistoryRow, stats: DeliveryStats) {
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    subject: row.subject,
    body: row.body,
    recipientCount: row.recipientCount,
    sentAt: row.sentAt?.toISOString() ?? null,
    stats,
  };
}

// Groups rows by send and keeps the given group order. Email comes first.
export function groupHistoryRows<T extends HistoryRow>(
  rows: T[],
  groupOrder: string[],
  stats: Map<string, DeliveryStats>
) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    groups.set(row.sendGroupId, [...(groups.get(row.sendGroupId) ?? []), row]);
  }
  return groupOrder.flatMap(sendGroupId => {
    const members = (groups.get(sendGroupId) ?? []).sort(
      (a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]
    );
    const lead = members[0];
    if (!lead) return [];
    return [
      {
        sendGroupId,
        lead,
        audienceType: lead.audienceType,
        audienceDefinition: lead.audienceDefinitionJson as Record<
          string,
          unknown
        > | null,
        sender: lead.sentBy ?? lead.createdBy,
        createdAt: lead.createdAt.toISOString(),
        communications: members.map(row =>
          historyItem(row, stats.get(row.id)!)
        ),
      },
    ];
  });
}

// One page of sent groups for an event, newest first.
export async function loadEventCommunicationHistory(
  eventId: string,
  page: number,
  pageSize: number,
  db = prisma
) {
  const where = { eventId, status: { not: 'DRAFT' as const } };
  const groupPage = await db.eventCommunication.groupBy({
    by: ['sendGroupId'],
    where,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  const hasMore = groupPage.length > pageSize;
  const groupIds = groupPage.slice(0, pageSize).map(row => row.sendGroupId);
  const rows = groupIds.length
    ? await db.eventCommunication.findMany({
        where: { ...where, sendGroupId: { in: groupIds } },
        select: communicationHistorySelect,
      })
    : [];
  const stats = await eventCommunicationDeliveryStats(
    rows.map(row => row.id),
    db
  );
  return {
    groups: groupHistoryRows(rows, groupIds, stats).map(
      ({ lead: _lead, ...group }) => group
    ),
    hasMore,
  };
}
