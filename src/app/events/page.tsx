'use client';

import { useEffect, useMemo, useState } from 'react';
import EventSummaryCard from '../components/EventSummaryCard';
import {
  PublicEventStatusBadge,
  ViewerRegistrationStatusBadge,
} from '../components/PublicEventCard';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '../components/ManagementSurface';
import type {
  PublicEventCard as PublicEventCardData,
  PublicEventChapterSummary,
} from '@/types/event-management';

function sortChapters(chapters: PublicEventChapterSummary[]) {
  return [...chapters].sort((a, b) => a.name.localeCompare(b.name));
}

export default function EventsPage() {
  const classes = useManagementClasses();
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEventCardData[]>(
    []
  );
  const [previousEvents, setPreviousEvents] = useState<PublicEventCardData[]>(
    []
  );
  const [chapters, setChapters] = useState<PublicEventChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedChapter) params.set('chapterSlug', selectedChapter);

    setIsLoading(true);
    setLoadError('');

    const upcomingQueryString = params.toString();
    params.set('period', 'previous');
    const previousQueryString = params.toString();

    Promise.all([
      fetch(
        `/api/events${upcomingQueryString ? `?${upcomingQueryString}` : ''}`
      ).then(response => {
        if (!response.ok) {
          throw new Error(`Events request failed with ${response.status}`);
        }
        return response.json() as Promise<PublicEventCardData[]>;
      }),
      fetch(`/api/events?${previousQueryString}`).then(response => {
        if (!response.ok) {
          throw new Error(
            `Previous events request failed with ${response.status}`
          );
        }
        return response.json() as Promise<PublicEventCardData[]>;
      }),
      fetch('/api/chapters').then(response => {
        if (!response.ok) {
          throw new Error(`Chapters request failed with ${response.status}`);
        }
        return response.json() as Promise<PublicEventChapterSummary[]>;
      }),
    ])
      .then(([nextUpcomingEvents, nextPreviousEvents, chaptersPayload]) => {
        if (cancelled) return;
        setUpcomingEvents(nextUpcomingEvents);
        setPreviousEvents(nextPreviousEvents);
        setChapters(sortChapters(chaptersPayload));
      })
      .catch(() => {
        if (!cancelled) {
          setUpcomingEvents([]);
          setPreviousEvents([]);
          setLoadError('Unable to load events.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChapter]);

  const visibleChapters = useMemo(
    () => chapters.filter(chapter => chapter.slug && chapter.name),
    [chapters]
  );

  return (
    <ManagementPage>
      <ManagementHeader
        title="Events"
        description="Browse published Sundai events from chapters around the world."
      />

      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-2 sm:max-w-xs">
        <label
          className={`text-sm font-semibold ${classes.mutedText}`}
          htmlFor="chapter-filter"
        >
          Chapter
        </label>
        <select
          className={classes.input}
          id="chapter-filter"
          onChange={event => setSelectedChapter(event.target.value)}
          value={selectedChapter}
        >
          <option value="">All chapters</option>
          {visibleChapters.map(chapter => (
            <option key={chapter.id} value={chapter.slug}>
              {chapter.name}
            </option>
          ))}
        </select>
      </div>

      <section aria-labelledby="upcoming-events-heading">
        <h2 className="mb-4 text-2xl font-bold" id="upcoming-events-heading">
          Upcoming events
        </h2>
        {isLoading ? (
          <ManagementEmptyState>Loading events.</ManagementEmptyState>
        ) : upcomingEvents.length === 0 ? (
          <ManagementEmptyState>
            No upcoming events are available.
          </ManagementEmptyState>
        ) : (
          <EventCardGrid events={upcomingEvents} />
        )}
      </section>

      <section aria-labelledby="previous-events-heading" className="mt-12">
        <h2 className="mb-4 text-2xl font-bold" id="previous-events-heading">
          Previous events
        </h2>
        {isLoading ? (
          <ManagementEmptyState>Loading events.</ManagementEmptyState>
        ) : previousEvents.length === 0 ? (
          <ManagementEmptyState>
            No previous events are available.
          </ManagementEmptyState>
        ) : (
          <EventCardGrid events={previousEvents} />
        )}
      </section>
    </ManagementPage>
  );
}

function EventCardGrid({ events }: { events: PublicEventCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map(event => (
        <div className="min-w-0" key={event.id}>
          <EventSummaryCard
            badges={
              <>
                <PublicEventStatusBadge status={event.publicStatus} />
                {event.viewerRegistrationStatus && (
                  <ViewerRegistrationStatusBadge
                    status={event.viewerRegistrationStatus}
                  />
                )}
              </>
            }
            event={event}
            eyebrow={event.chapterName}
            href={`/events/${event.chapterSlug}/${event.slug}`}
          />
        </div>
      ))}
    </div>
  );
}
