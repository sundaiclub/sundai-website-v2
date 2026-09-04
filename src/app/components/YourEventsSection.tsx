'use client';

import EventSummaryCard from './EventSummaryCard';
import { motion } from 'framer-motion';
import type { CurrentUserEvent } from '@/types/event-management';

function formatEventTime(event: CurrentUserEvent) {
  const timezone = event.timezone || event.chapter.timezone;
  const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  const start = dateTimeFormat.format(new Date(event.startTime));
  return event.endTime
    ? `${start}–${timeFormat.format(new Date(event.endTime))}`
    : start;
}

export default function YourEventsSection({
  events,
  isDarkMode,
  isSignedIn,
  isLoading,
}: {
  events: CurrentUserEvent[];
  isDarkMode: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
}) {
  const panelClasses = isDarkMode
    ? 'border-gray-700 bg-gray-800 text-gray-100'
    : 'border-gray-200 bg-white text-gray-900';
  const mutedClasses = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <motion.section
      className="mx-auto w-full max-w-7xl px-4 pt-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      aria-labelledby="your-events-heading"
    >
      <div className="mb-6">
        <h1
          id="your-events-heading"
          className={`text-3xl font-bold ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
          Your events
        </h1>
        <p className={`mt-1 text-sm ${mutedClasses}`}>
          Events that you are taking part in.
        </p>
      </div>

      {isLoading ? (
        <div
          className={`h-20 animate-pulse rounded-xl border ${panelClasses}`}
          aria-label="Loading your events"
        />
      ) : events.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventSummaryCard
              key={event.id}
              event={event}
              href={`/events/${event.chapterSlug}/${event.slug}`}
              eyebrow={event.chapterName}
              dateLabel={formatEventTime(event)}
            />
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border p-6 text-sm ${panelClasses}`}>
          {isSignedIn
            ? 'You have no events happening now.'
            : 'Sign in to see events that you are taking part in.'}
        </div>
      )}
    </motion.section>
  );
}
