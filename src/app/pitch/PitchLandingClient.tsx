'use client';

import { useState } from 'react';
import { AddProjectDialog } from '@/app/components/AddProjectDialog';
import {
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '@/app/components/ManagementSurface';

export type PitchLandingEvent = {
  id: string;
  title: string;
  chapterName: string;
  chapterSlug: string;
  slug: string;
};

export default function PitchLandingClient({
  events,
}: {
  events: PitchLandingEvent[];
}) {
  const classes = useManagementClasses();
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
            <button
              className={`${classes.panel} min-h-32 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              type="button"
            >
              <span
                className={`block text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                {event.chapterName}
              </span>
              <span className="mt-2 block text-xl font-bold">
                {event.title}
              </span>
            </button>
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
