'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { CurrentUserEvent } from '@/types/event-management';

function formatEventTime(event: CurrentUserEvent) {
  const timezone = event.timezone || event.chapter.timezone;
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  return `${timeFormat.format(new Date(event.startTime))}–${timeFormat.format(
    new Date(event.endTime)
  )}`;
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
          Events that you are taking part in now.
        </p>
      </div>

      {isLoading ? (
        <div
          className={`h-20 animate-pulse rounded-xl border ${panelClasses}`}
          aria-label="Loading your events"
        />
      ) : events.length > 0 ? (
        <div className="space-y-3">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/events/${event.chapterSlug}/${event.slug}`}
              aria-label={`View ${event.title}`}
              className={`group flex flex-col gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${panelClasses}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-full bg-green-500" />
                  <h2 className="truncate text-lg font-semibold group-hover:underline">
                    {event.title}
                  </h2>
                </div>
                <p
                  className={`mt-1 truncate pl-[18px] text-sm ${mutedClasses}`}
                >
                  {[event.chapterName, event.publicLocation]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-none items-center justify-between gap-4 pl-[18px] sm:pl-0">
                <span className={`text-sm ${mutedClasses}`}>
                  {formatEventTime(event)}
                </span>
                <span
                  className={`text-lg ${
                    isDarkMode ? 'text-purple-300' : 'text-indigo-600'
                  }`}
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
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
