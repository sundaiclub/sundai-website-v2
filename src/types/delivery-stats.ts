export type DeliveryFailureReason = {
  code: string | null;
  label: string;
  // What usually fixes it.
  hint: string | null;
  // One provider message for this code, with contact details removed.
  example: string | null;
  count: number;
};

export type DeliveryLinkStats = {
  url: string;
  kind: 'CONTENT' | 'PREFERENCES';
  clicks: number;
  uniqueClicks: number;
  botClicks: number;
  // People who registered for the linked event after clicking. Null when the
  // link does not open an event page.
  rsvps: number | null;
};

// Aggregate results for one message channel. Recipient rows stay private.
export type DeliveryStats = {
  total: number;
  // Not yet handed to the provider.
  pending: number;
  // Accepted by SES or Twilio with no delivery confirmation yet.
  accepted: number;
  delivered: number;
  failed: number;
  complained: number;
  // One-click unsubscribes from the email header.
  unsubscribed: number;
  // People who opened at least one content link. Bot clicks are excluded.
  clicked: number;
  // People who clicked an event link and then registered for that event.
  rsvps: number;
  hasEventLinks: boolean;
  // People who opened an unsubscribe or preferences link.
  preferenceClicks: number;
  botClicks: number;
  failureReasons: DeliveryFailureReason[];
  links: DeliveryLinkStats[];
};

export type HealthLevel = 'ok' | 'warning' | 'critical';

// Recent sending reputation across all chapters.
export type MessagingHealth = {
  windowDays: number;
  emailEventsConfigured: boolean;
  email: {
    sent: number;
    delivered: number;
    hardBounces: number;
    complaints: number;
    bounceRate: number;
    complaintRate: number;
    bounceLevel: HealthLevel;
    complaintLevel: HealthLevel;
  };
  sms: { sent: number; failed: number; failureRate: number };
};
