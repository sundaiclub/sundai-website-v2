'use client';

import Image from 'next/image';
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
  image?: { url: string; alt?: string | null } | null;
};

export default function PitchLandingClient({
  events,
}: {
  events: PitchLandingEvent[];
}) {
  const classes = useManagementClasses();
  const defaultEventImage = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';
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
              className={`${classes.panel} overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              type="button"
            >
              <span className="relative block aspect-[3/2] w-full overflow-hidden bg-black">
                <Image
                  alt={event.image?.alt || `${event.title} event`}
                  className={
                    event.image?.url ? 'object-contain' : 'object-contain p-8'
                  }
                  fill
                  sizes="(min-width: 640px) 420px, 100vw"
                  src={event.image?.url || defaultEventImage}
                  unoptimized={Boolean(event.image?.url)}
                />
              </span>
              <span className="block p-5">
                <span
                  className={`block text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
                >
                  {event.chapterName}
                </span>
                <span className="mt-2 block text-xl font-bold">
                  {event.title}
                </span>
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
