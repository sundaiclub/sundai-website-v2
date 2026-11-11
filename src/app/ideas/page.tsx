import type { Metadata } from 'next';
import EventSummaryCard from '@/app/components/EventSummaryCard';
import {
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
} from '@/app/components/ManagementSurface';
import { listTodaysPublicEvents } from '@/lib/eventIdeas';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ideas | Sundai Club',
  description: "Pick one of today's events to share and browse project ideas.",
};

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

export default async function IdeasLandingPage() {
  const events = await listTodaysPublicEvents();

  return (
    <ManagementPage maxWidth="max-w-4xl">
      <ManagementHeader
        title="Ideas"
        description="Pick today's event to share what you want to build and see everyone else's ideas."
      />

      {events.length === 0 ? (
        <ManagementEmptyState>
          <div className="flex flex-col items-center gap-4">
            <span>There are no public events happening today.</span>
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
              href={`/events/${encodeURIComponent(event.chapterSlug)}/${encodeURIComponent(event.slug)}?tab=ideas`}
              key={event.id}
            />
          ))}
        </div>
      )}
    </ManagementPage>
  );
}
