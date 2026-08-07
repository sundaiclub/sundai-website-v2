import type {
  EventCommunicationRecipientStatus,
  EventCommunicationStatus,
} from '@prisma/client';

export type AdminCommunicationStats = {
  total: number;
  pending: number;
  accepted: number;
  delivered: number;
  failed: number;
};

export type AdminCommunicationListItem = {
  id: string;
  channel: 'EMAIL' | 'SMS';
  status: EventCommunicationStatus;
  subject: string | null;
  excerpt: string;
  sentAt: string;
  chapter: { id: string; name: string; slug: string };
  event: { id: string; title: string };
  sentBy: { id: string; name: string; email: string | null } | null;
  stats: AdminCommunicationStats;
};

export type AdminCommunicationDetail = AdminCommunicationListItem & {
  body: string;
  audienceType: string;
  audienceDefinition: unknown;
  createdAt: string;
  recipients: Array<{
    id: string;
    displayName: string;
    contactValue: string;
    status: EventCommunicationRecipientStatus;
    providerMessageId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    attemptedAt: string | null;
    deliveredAt: string | null;
  }>;
};
