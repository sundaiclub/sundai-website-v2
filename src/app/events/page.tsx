'use client';

import { useEffect, useMemo, useState } from 'react';
import PublicEventCard from '../components/PublicEventCard';
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
  const [events, setEvents] = useState<PublicEventCardData[]>([]);
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

    const queryString = params.toString();

    Promise.all([
      fetch(`/api/events${queryString ? `?${queryString}` : ''}`).then(
        response => {
          if (!response.ok) {
            throw new Error(`Events request failed with ${response.status}`);
          }
          return response.json() as Promise<PublicEventCardData[]>;
        }
      ),
      fetch('/api/chapters').then(response => {
        if (!response.ok) {
          throw new Error(`Chapters request failed with ${response.status}`);
        }
        return response.json() as Promise<PublicEventChapterSummary[]>;
      }),
    ])
      .then(([nextEvents, chaptersPayload]) => {
        if (cancelled) return;
        setEvents(nextEvents);
        setChapters(sortChapters(chaptersPayload));
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
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
        title="Upcoming Events"
        description="Browse published Sundai events and find the next gathering in your chapter."
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

      {isLoading ? (
        <ManagementEmptyState>Loading events.</ManagementEmptyState>
      ) : events.length === 0 ? (
        <ManagementEmptyState>
          No upcoming events are available.
        </ManagementEmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map(event => (
            <PublicEventCard event={event} key={event.id} />
          ))}
        </div>
      )}
    </ManagementPage>
  );
}
