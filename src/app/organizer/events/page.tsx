'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';

type EventItem = {
  id: string;
  title: string;
  startTime: string;
  chapter?: { name: string };
};

function list(payload: unknown): EventItem[] {
  return Array.isArray(payload) ? (payload as EventItem[]) : [];
}

export default function OrganizerEventsPage() {
  const classes = useManagementClasses();
  const { isAdmin } = useUserContext();
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then(response => (response.ok ? response.json() : []))
      .then(payload => setEvents(list(payload)))
      .catch(() => setEvents([]));
  }, []);

  return (
    <ManagementPage>
      <ManagementHeader
        eyebrow="Organizer"
        title="Organizer events"
        description="Review events you can manage and open their operational settings."
        actions={
          isAdmin && (
            <ManagementLinkButton
              href="/organizer/events/new"
              variant="primary"
            >
              New event
            </ManagementLinkButton>
          )
        }
      />
      <ManagementSection title="Events">
        <div className={`divide-y ${classes.divider}`}>
          {events.map(event => (
            <Link
              key={event.id}
              href={`/organizer/events/${event.id}/settings`}
              className="grid gap-2 rounded-md py-4 transition hover:px-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{event.title}</div>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {event.chapter?.name || 'Chapter event'}
                </div>
              </div>
              <ManagementBadge>
                {new Date(event.startTime).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </ManagementBadge>
            </Link>
          ))}
          {events.length === 0 && (
            <ManagementEmptyState>
              No organizer events are available.
            </ManagementEmptyState>
          )}
        </div>
      </ManagementSection>
    </ManagementPage>
  );
}
