import type { ReactNode } from 'react';
import EventSummaryCard from '@/app/components/EventSummaryCard';
import {
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
} from '@/app/components/ManagementSurface';
import { eventTabPath, type EventPickerItem } from '@/lib/eventPicker';

function timeRangeLabel(start: Date, end: Date | null, timeZone: string) {
  const format = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  });
  return end ? format.formatRange(start, end) : format.format(start);
}

export function EventPickerPage({
  title,
  description,
  emptyMessage,
  events,
  tab,
}: {
  title: string;
  description: string;
  emptyMessage: ReactNode;
  events: EventPickerItem[];
  tab: string;
}) {
  return (
    <ManagementPage maxWidth="max-w-4xl">
      <ManagementHeader title={title} description={description} />

      {events.length === 0 ? (
        <ManagementEmptyState>
          <div className="flex flex-col items-center gap-4">
            <span>{emptyMessage}</span>
            <ManagementLinkButton href="/events">
              See upcoming events
            </ManagementLinkButton>
          </div>
        </ManagementEmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map(event => (
            <EventSummaryCard
              dateLabel={timeRangeLabel(
                event.startTime,
                event.endTime,
                event.timezone
              )}
              event={event}
              eyebrow={event.chapterName}
              href={eventTabPath(event, tab)}
              key={event.id}
            />
          ))}
        </div>
      )}
    </ManagementPage>
  );
}
