'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';
import type { OrganizerEventListItem } from '@/types/event-management';

function list(payload: unknown): OrganizerEventListItem[] {
  return Array.isArray(payload) ? (payload as OrganizerEventListItem[]) : [];
}

export default function OrganizerEventsPage() {
  const classes = useManagementClasses();
  const { isAdmin } = useUserContext();
  const [events, setEvents] = useState<OrganizerEventListItem[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setAuthStatus(null);
    setLoadError('');
    fetch('/api/events?organizer=true')
      .then(response => {
        const nextAuthStatus = authStatusFromResponse(response);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return null;
        }
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => {
        if (isCurrent && payload) setEvents(list(payload));
      })
      .catch(() => {
        if (isCurrent) setLoadError('Unable to load organizer events.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading) {
    return (
      <ManagementPage>
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage>
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage>
      <div className="mb-4">
        <ManagementBackButton />
      </div>
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
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
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
