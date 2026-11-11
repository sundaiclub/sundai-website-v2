import prisma from '@/lib/prisma';
import type { HealthLevel, MessagingHealth } from '@/types/delivery-stats';

const WINDOW_DAYS = 30;
// SES reviews an account at a 5% hard bounce rate or a 0.1% complaint rate.
// Warnings start earlier so there is time to react.
const BOUNCE_LEVELS = { warning: 0.02, critical: 0.05 };
const COMPLAINT_LEVELS = { warning: 0.0008, critical: 0.001 };

const rate = (value: number, total: number) => (total ? value / total : 0);
const level = (value: number, limits: typeof BOUNCE_LEVELS): HealthLevel =>
  value >= limits.critical
    ? 'critical'
    : value >= limits.warning
      ? 'warning'
      : 'ok';

// Sends and outcomes from event emails and weekly emails in the last 30 days.
export async function loadMessagingHealth(
  db = prisma,
  now = new Date()
): Promise<MessagingHealth> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const accepted = { in: ['SENT', 'DELIVERED', 'UNDELIVERED'] as const };
  const hardBounce = {
    status: 'UNDELIVERED' as const,
    errorCode: { startsWith: 'Bounce.Permanent.' },
  };
  const eventEmail = {
    attemptedAt: { gte: since },
    communication: { channel: 'EMAIL' as const },
  };
  const weekly = { attemptedAt: { gte: since } };
  const sms = {
    attemptedAt: { gte: since },
    communication: { channel: 'SMS' as const },
  };
  const counts = await Promise.all([
    db.eventCommunicationRecipient.count({
      where: { ...eventEmail, status: { in: [...accepted.in] } },
    }),
    db.weeklyEmailRecipient.count({
      where: { ...weekly, status: { in: [...accepted.in] } },
    }),
    db.eventCommunicationRecipient.count({
      where: { ...eventEmail, status: 'DELIVERED' },
    }),
    db.weeklyEmailRecipient.count({
      where: { ...weekly, status: 'DELIVERED' },
    }),
    db.eventCommunicationRecipient.count({
      where: { ...eventEmail, ...hardBounce },
    }),
    db.weeklyEmailRecipient.count({ where: { ...weekly, ...hardBounce } }),
    db.eventCommunicationRecipient.count({
      where: { ...eventEmail, complainedAt: { not: null } },
    }),
    db.weeklyEmailRecipient.count({
      where: { ...weekly, complainedAt: { not: null } },
    }),
    db.eventCommunicationRecipient.count({ where: sms }),
    db.eventCommunicationRecipient.count({
      where: { ...sms, status: { in: ['FAILED', 'UNDELIVERED'] } },
    }),
  ]);
  const [sent, delivered, hardBounces, complaints] = [0, 2, 4, 6].map(
    index => counts[index] + counts[index + 1]
  );
  const [smsSent, smsFailed] = counts.slice(8);
  const bounceRate = rate(hardBounces, sent);
  const complaintRate = rate(complaints, sent);
  return {
    windowDays: WINDOW_DAYS,
    emailEventsConfigured: Boolean(process.env.AWS_SES_EVENTS_TOPIC_ARN),
    email: {
      sent,
      delivered,
      hardBounces,
      complaints,
      bounceRate,
      complaintRate,
      bounceLevel: level(bounceRate, BOUNCE_LEVELS),
      complaintLevel: level(complaintRate, COMPLAINT_LEVELS),
    },
    sms: {
      sent: smsSent,
      failed: smsFailed,
      failureRate: rate(smsFailed, smsSent),
    },
  };
}
