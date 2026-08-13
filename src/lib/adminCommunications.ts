import type { EventCommunicationRecipientStatus } from '@prisma/client';
import type { AdminCommunicationStats } from '@/types/admin-communications';

export function fiveWordExcerpt(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 5).join(' ');
  return words.length > 5 ? `${excerpt}…` : excerpt;
}

export function communicationStats(
  statuses: EventCommunicationRecipientStatus[]
): AdminCommunicationStats {
  return {
    total: statuses.length,
    pending: statuses.filter(status =>
      ['PENDING', 'SENDING'].includes(status)
    ).length,
    accepted: statuses.filter(status => status === 'SENT').length,
    delivered: statuses.filter(status => status === 'DELIVERED').length,
    failed: statuses.filter(status =>
      ['FAILED', 'UNDELIVERED'].includes(status)
    ).length,
  };
}
