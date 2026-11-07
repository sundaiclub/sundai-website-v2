import { Prisma, type EventCommunicationRecipientStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  deliveryFailureReason,
  failureExample,
} from '@/lib/deliveryFailureReasons';
import type { DeliveryStats } from '@/types/delivery-stats';

const FAILED_STATUSES: EventCommunicationRecipientStatus[] = [
  'FAILED',
  'UNDELIVERED',
];
const MAX_LINKS = 20;

type Counted = { _count: { _all: number } };
type LinkRow = {
  sourceId: string;
  url: string;
  kind: 'CONTENT' | 'PREFERENCES';
  isEventLink: boolean;
  clicks: number;
  uniqueClicks: number;
  botClicks: number;
  rsvps: number;
};
type ClickTotalRow = {
  sourceId: string;
  clicked: number;
  preferenceClicks: number;
  rsvps: number;
};
type StatsRows = {
  statuses: Array<
    { sourceId: string; status: EventCommunicationRecipientStatus } & Counted
  >;
  reasons: Array<
    {
      sourceId: string;
      errorCode: string | null;
      _max: { errorMessage: string | null };
    } & Counted
  >;
  complained: Array<{ sourceId: string } & Counted>;
  unsubscribed: Array<{ sourceId: string } & Counted>;
  links: LinkRow[];
  clickTotals: ClickTotalRow[];
};

export function emptyDeliveryStats(): DeliveryStats {
  return {
    total: 0,
    pending: 0,
    accepted: 0,
    delivered: 0,
    failed: 0,
    complained: 0,
    unsubscribed: 0,
    clicked: 0,
    rsvps: 0,
    hasEventLinks: false,
    preferenceClicks: 0,
    botClicks: 0,
    failureReasons: [],
    links: [],
  };
}

export function buildDeliveryStats(sourceIds: string[], rows: StatsRows) {
  const stats = new Map(sourceIds.map(id => [id, emptyDeliveryStats()]));
  for (const row of rows.statuses) {
    const item = stats.get(row.sourceId);
    if (!item) continue;
    const count = row._count._all;
    item.total += count;
    if (row.status === 'PENDING' || row.status === 'SENDING')
      item.pending += count;
    else if (row.status === 'SENT') item.accepted += count;
    else if (row.status === 'DELIVERED') item.delivered += count;
    else item.failed += count;
  }
  for (const row of rows.reasons) {
    stats.get(row.sourceId)?.failureReasons.push({
      code: row.errorCode,
      ...deliveryFailureReason(row.errorCode),
      example: failureExample(row._max.errorMessage),
      count: row._count._all,
    });
  }
  for (const row of rows.complained) {
    const item = stats.get(row.sourceId);
    if (item) item.complained = row._count._all;
  }
  for (const row of rows.unsubscribed) {
    const item = stats.get(row.sourceId);
    if (item) item.unsubscribed = row._count._all;
  }
  for (const row of rows.clickTotals) {
    const item = stats.get(row.sourceId);
    if (!item) continue;
    item.clicked = row.clicked;
    item.preferenceClicks = row.preferenceClicks;
    item.rsvps = row.rsvps;
  }
  for (const row of rows.links) {
    const item = stats.get(row.sourceId);
    if (!item) continue;
    item.botClicks += row.botClicks;
    if (row.isEventLink) item.hasEventLinks = true;
    item.links.push({
      url: row.url,
      kind: row.kind,
      clicks: row.clicks,
      uniqueClicks: row.uniqueClicks,
      botClicks: row.botClicks,
      rsvps: row.isEventLink ? row.rsvps : null,
    });
  }
  for (const item of stats.values()) {
    item.failureReasons.sort((a, b) => b.count - a.count);
    item.links.sort(
      (a, b) =>
        Number(a.kind === 'PREFERENCES') - Number(b.kind === 'PREFERENCES') ||
        b.uniqueClicks - a.uniqueClicks ||
        b.clicks - a.clicks
    );
    item.links = item.links.slice(0, MAX_LINKS);
  }
  return stats;
}

// Fixed SQL identifiers for each recipient source. Never from request input.
const CLICK_SOURCES = {
  event: {
    link: Prisma.raw('l."eventCommunicationId"'),
    recipient: Prisma.raw('c."eventRecipientId"'),
    table: Prisma.raw('"EventCommunicationRecipient"'),
  },
  weekly: {
    link: Prisma.raw('l."weeklyEmailId"'),
    recipient: Prisma.raw('c."weeklyRecipientId"'),
    table: Prisma.raw('"WeeklyEmailRecipient"'),
  },
};

// A click counts as an RSVP when that person registers for the linked event
// after the click.
const registeredAfterClick = Prisma.sql`EXISTS (
  SELECT 1 FROM "EventRegistration" er
  WHERE er."eventId" = l."eventId"
    AND er."hackerId" = r."hackerId"
    AND er."createdAt" >= c."clickedAt"
)`;

async function clickStats(
  kind: keyof typeof CLICK_SOURCES,
  sourceIds: string[],
  db: typeof prisma
) {
  const source = CLICK_SOURCES[kind];
  const ids = Prisma.join(sourceIds);
  const [links, clickTotals] = await Promise.all([
    db.$queryRaw<LinkRow[]>`
      SELECT ${source.link} AS "sourceId", l.url, l.kind::text AS kind,
        (l."eventId" IS NOT NULL) AS "isEventLink",
        COUNT(c.id) FILTER (WHERE c."isBot" = false)::int AS clicks,
        COUNT(DISTINCT ${source.recipient}) FILTER (WHERE c."isBot" = false)::int AS "uniqueClicks",
        COUNT(c.id) FILTER (WHERE c."isBot")::int AS "botClicks",
        COUNT(DISTINCT ${source.recipient}) FILTER (
          WHERE c."isBot" = false AND ${registeredAfterClick}
        )::int AS rsvps
      FROM "MessageLink" l
      LEFT JOIN "MessageLinkClick" c ON c."linkId" = l.id
      LEFT JOIN ${source.table} r ON r.id = ${source.recipient}
      WHERE ${source.link} IN (${ids})
      GROUP BY l.id`,
    db.$queryRaw<ClickTotalRow[]>`
      SELECT ${source.link} AS "sourceId",
        COUNT(DISTINCT ${source.recipient}) FILTER (WHERE l.kind = 'CONTENT')::int AS clicked,
        COUNT(DISTINCT ${source.recipient}) FILTER (WHERE l.kind = 'PREFERENCES')::int AS "preferenceClicks",
        COUNT(DISTINCT ${source.recipient}) FILTER (
          WHERE l.kind = 'CONTENT' AND ${registeredAfterClick}
        )::int AS rsvps
      FROM "MessageLinkClick" c
      JOIN "MessageLink" l ON l.id = c."linkId"
      JOIN ${source.table} r ON r.id = ${source.recipient}
      WHERE c."isBot" = false AND ${source.link} IN (${ids})
      GROUP BY 1`,
  ]);
  return { links, clickTotals };
}

export async function eventCommunicationDeliveryStats(
  communicationIds: string[],
  db = prisma
) {
  if (!communicationIds.length) return new Map<string, DeliveryStats>();
  const where = { communicationId: { in: communicationIds } };
  const count = { _count: { _all: true } } as const;
  const [statuses, reasons, complained, unsubscribed, clicks] =
    await Promise.all([
      db.eventCommunicationRecipient.groupBy({
        by: ['communicationId', 'status'],
        where,
        ...count,
      }),
      db.eventCommunicationRecipient.groupBy({
        by: ['communicationId', 'errorCode'],
        where: { ...where, status: { in: FAILED_STATUSES } },
        _max: { errorMessage: true },
        ...count,
      }),
      db.eventCommunicationRecipient.groupBy({
        by: ['communicationId'],
        where: { ...where, complainedAt: { not: null } },
        ...count,
      }),
      db.eventCommunicationRecipient.groupBy({
        by: ['communicationId'],
        where: { ...where, unsubscribedAt: { not: null } },
        ...count,
      }),
      clickStats('event', communicationIds, db),
    ]);
  const bySource = <T extends { communicationId: string }>(rows: T[]) =>
    rows.map(row => ({ ...row, sourceId: row.communicationId }));
  return buildDeliveryStats(communicationIds, {
    statuses: bySource(statuses),
    reasons: bySource(reasons),
    complained: bySource(complained),
    unsubscribed: bySource(unsubscribed),
    ...clicks,
  });
}

export async function weeklyEmailDeliveryStats(
  weeklyEmailIds: string[],
  db = prisma
) {
  if (!weeklyEmailIds.length) return new Map<string, DeliveryStats>();
  const where = { weeklyEmailId: { in: weeklyEmailIds } };
  const count = { _count: { _all: true } } as const;
  const [statuses, reasons, complained, unsubscribed, clicks] =
    await Promise.all([
      db.weeklyEmailRecipient.groupBy({
        by: ['weeklyEmailId', 'status'],
        where,
        ...count,
      }),
      db.weeklyEmailRecipient.groupBy({
        by: ['weeklyEmailId', 'errorCode'],
        where: { ...where, status: { in: FAILED_STATUSES } },
        _max: { errorMessage: true },
        ...count,
      }),
      db.weeklyEmailRecipient.groupBy({
        by: ['weeklyEmailId'],
        where: { ...where, complainedAt: { not: null } },
        ...count,
      }),
      db.weeklyEmailRecipient.groupBy({
        by: ['weeklyEmailId'],
        where: { ...where, unsubscribedAt: { not: null } },
        ...count,
      }),
      clickStats('weekly', weeklyEmailIds, db),
    ]);
  const bySource = <T extends { weeklyEmailId: string }>(rows: T[]) =>
    rows.map(row => ({ ...row, sourceId: row.weeklyEmailId }));
  return buildDeliveryStats(weeklyEmailIds, {
    statuses: bySource(statuses),
    reasons: bySource(reasons),
    complained: bySource(complained),
    unsubscribed: bySource(unsubscribed),
    ...clicks,
  });
}
