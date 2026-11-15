'use client';

import type { ReactNode } from 'react';
import type {
  EventCommunicationHistoryItem,
  EventCommunicationStatus,
} from '@/types/event-workspace';
import DeliveryStatsSummary from './DeliveryStatsSummary';
import { ManagementBadge, useManagementClasses } from './ManagementSurface';

const STATUS: Record<
  EventCommunicationStatus,
  { label: string; tone: 'default' | 'success' | 'warning' | 'danger' }
> = {
  DRAFT: { label: 'Draft', tone: 'default' },
  SENDING: { label: 'Sending', tone: 'warning' },
  SENT: { label: 'Sent', tone: 'success' },
  PARTIAL: { label: 'Some failed', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

// One send: its heading, a status per channel, and delivery results for each
// channel side by side. Details add failure reasons, links, and the messages.
export default function CommunicationGroupCard({
  title,
  meta,
  communications,
  detailed = false,
  actions,
  locations,
}: {
  title: string;
  meta: ReactNode;
  communications: EventCommunicationHistoryItem[];
  detailed?: boolean;
  actions?: ReactNode;
  locations?: string[] | null;
}) {
  const classes = useManagementClasses();
  return (
    <article className={`${classes.subtlePanel} overflow-hidden`}>
      <header
        className={`flex flex-wrap items-start justify-between gap-3 border-b p-4 ${
          classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'
        }`}
      >
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug">{title}</h3>
          <div className={`mt-1 text-sm ${classes.mutedText}`}>{meta}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {communications.map(item => (
            <ManagementBadge key={item.id} tone={STATUS[item.status].tone}>
              {item.channel === 'EMAIL' ? 'Email' : 'SMS'}:{' '}
              {STATUS[item.status].label}
            </ManagementBadge>
          ))}
          {actions}
        </div>
      </header>
      <div
        className={`grid gap-px ${communications.length > 1 ? 'md:grid-cols-2' : ''} ${
          classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
        }`}
      >
        {communications.map(item => (
          <div
            className={`p-4 ${classes.isDarkMode ? 'bg-gray-950/60' : 'bg-gray-50'}`}
            key={item.id}
          >
            <DeliveryStatsSummary
              channel={item.channel}
              detailed={detailed}
              stats={item.stats}
            />
          </div>
        ))}
      </div>
      {detailed && (
        <footer
          className={`space-y-4 border-t p-4 ${
            classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'
          }`}
        >
          <p className="text-sm">
            <span className={classes.mutedText}>Locations: </span>
            {locations?.length ? locations.join(', ') : 'All locations'}
          </p>
          {communications.map(item => (
            <div key={item.id}>
              <h4
                className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                {item.channel === 'EMAIL' ? 'Email message' : 'SMS message'}
              </h4>
              <p
                className={`whitespace-pre-wrap break-words rounded-md border p-3 text-sm ${
                  classes.isDarkMode
                    ? 'border-gray-800 bg-gray-900'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {item.body}
              </p>
            </div>
          ))}
        </footer>
      )}
    </article>
  );
}

export function locationNames(definition: Record<string, unknown> | null) {
  return Array.isArray(definition?.locationNames)
    ? (definition.locationNames as string[])
    : null;
}
