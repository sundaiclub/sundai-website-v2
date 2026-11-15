import type {
  EventCommunicationHistoryGroup,
  EventCommunicationHistoryItem,
} from './event-workspace';

// One organizer send. The email and SMS versions share one entry.
export type AdminCommunicationListItem = Omit<
  EventCommunicationHistoryGroup,
  'communications'
> & {
  id: string;
  subject: string | null;
  excerpt: string;
  sentAt: string;
  chapter: { id: string; name: string; slug: string };
  event: { id: string; title: string };
  communications: EventCommunicationHistoryItem[];
};

export type AdminCommunicationDetail = AdminCommunicationListItem;
