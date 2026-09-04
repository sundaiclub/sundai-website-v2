'use client';

import EventSummaryCard from '@/app/components/EventSummaryCard';
import { useState } from 'react';
import { AddProjectDialog } from '@/app/components/AddProjectDialog';
import {
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
} from '@/app/components/ManagementSurface';

export type PitchLandingEvent = {
  id: string;
  title: string;
  chapterName: string;
  chapterSlug: string;
  slug: string;
  image?: { url: string; alt?: string | null } | null;
};

export default function PitchLandingClient({
  events,
}: {
  events: PitchLandingEvent[];
}) {
  const [selectedEvent, setSelectedEvent] = useState<PitchLandingEvent | null>(
    null
  );

  return (
    <ManagementPage maxWidth="max-w-4xl">
      <ManagementHeader
        title="Pitch"
        description="Choose an active event and add one of your projects to its pitch queue."
      />

      {events.length === 0 ? (
        <ManagementEmptyState>
          You are not a part of any active events right now.
        </ManagementEmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map(event => (
            <EventSummaryCard
              key={event.id}
              event={event}
              eyebrow={event.chapterName}
              onClick={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      )}

      {selectedEvent && (
        <AddProjectDialog
          eventId={selectedEvent.id}
          eventTitle={selectedEvent.title}
          onClose={() => setSelectedEvent(null)}
          open
          redirectTo={`/events/${encodeURIComponent(selectedEvent.chapterSlug)}/${encodeURIComponent(selectedEvent.slug)}?tab=pitch`}
          returnTo={`/events/${encodeURIComponent(selectedEvent.chapterSlug)}/${encodeURIComponent(selectedEvent.slug)}?tab=pitch`}
        />
      )}
    </ManagementPage>
  );
}
