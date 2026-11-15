import prisma from '@/lib/prisma';
import {
  communicationHistorySelect,
  groupHistoryRows,
} from '@/lib/communicationHistory';
import { eventCommunicationDeliveryStats } from '@/lib/deliveryStats';

export function fiveWordExcerpt(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 5).join(' ');
  return words.length > 5 ? `${excerpt}…` : excerpt;
}

const adminSelect = {
  ...communicationHistorySelect,
  event: {
    select: {
      id: true,
      title: true,
      chapter: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

// Loads sent groups with aggregate delivery results for site admins.
export async function loadAdminCommunicationGroups(
  where: { sentAt: { not: null }; eventId?: string; sendGroupId?: string },
  groupKeys: Array<{ eventId: string; sendGroupId: string }>,
  db = prisma
) {
  const rows = groupKeys.length
    ? await db.eventCommunication.findMany({
        where: {
          ...where,
          OR: groupKeys.map(key => ({
            eventId: key.eventId,
            sendGroupId: key.sendGroupId,
          })),
        },
        select: adminSelect,
      })
    : [];
  const stats = await eventCommunicationDeliveryStats(
    rows.map(row => row.id),
    db
  );
  return groupHistoryRows(
    rows,
    groupKeys.map(key => key.sendGroupId),
    stats
  ).map(({ lead, communications, ...group }) => ({
    ...group,
    id: lead.id,
    subject: communications.find(item => item.subject)?.subject ?? null,
    excerpt: fiveWordExcerpt(lead.body),
    sentAt: communications
      .map(item => item.sentAt)
      .filter(Boolean)
      .sort()[0]!,
    chapter: lead.event.chapter,
    event: { id: lead.event.id, title: lead.event.title },
    communications,
  }));
}
