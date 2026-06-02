'use client';

import { useEffect, useState } from 'react';
import OrganizerNotePanel from '../../../../components/OrganizerNotePanel';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { OrganizerEventSettings } from '@/types/event-management';

export default function OrganizerEventSettingsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const [event, setEvent] = useState<OrganizerEventSettings | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setAuthStatus(null);
    setLoadError('');
    fetch(`/api/events/${params.eventId}?management=true`)
      .then(response => {
        const nextAuthStatus = authStatusFromResponse(response);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return null;
        }
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<OrganizerEventSettings>;
      })
      .then(payload => {
        if (!isCurrent || !payload) return;
        setEvent(payload);
        setTitle(payload.title);
      })
      .catch(() => {
        if (isCurrent) setLoadError('Unable to load event settings.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [params.eventId]);

  async function saveSettings() {
    const response = await fetch(`/api/events/${params.eventId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const nextAuthStatus = authStatusFromResponse(response);
    if (nextAuthStatus) {
      setAuthStatus(nextAuthStatus);
      return;
    }

    setMessage(
      response.ok ? 'Event settings saved' : 'Unable to save event settings'
    );
  }

  if (isLoading) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  if (loadError || !event) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert tone="danger">
          {loadError || 'Unable to load event settings.'}
        </ManagementAlert>
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-5xl">
      <div className="mb-4">
        <ManagementBackButton />
      </div>
      <ManagementHeader
        eyebrow="Organizer"
        title={event.title || 'Event settings'}
        description="Update event details, staff assignments, application composition, and organizer notes."
        actions={
          <>
            {event.visibility && (
              <ManagementBadge>{event.visibility}</ManagementBadge>
            )}
            {event.applicationMode && (
              <ManagementBadge>{event.applicationMode}</ManagementBadge>
            )}
          </>
        }
      />
      <div className="grid gap-5">
        <ManagementSection title="Basics">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Title</span>
            <input
              className={classes.input}
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </label>
        </ManagementSection>

        <ManagementSection
          title="Staff"
          actions={
            <button className={classes.secondaryButton} type="button">
              Assign MC
            </button>
          }
        >
          <div className={`divide-y ${classes.divider}`}>
            {event.staff.map(staff => (
              <div
                key={staff.id}
                className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="font-semibold">
                  {staff.hacker?.name || staff.id}
                </div>
                <ManagementBadge>{staff.role}</ManagementBadge>
              </div>
            ))}
            {event.staff.length === 0 && (
              <ManagementEmptyState>
                No staff has been assigned.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection
          title="Application questions"
          description="Preview the event application after site and chapter questions are merged."
          actions={
            <button className={classes.secondaryButton} type="button">
              Preview merged application
            </button>
          }
        >
          <ManagementEmptyState>
            No event-specific questions are shown here yet.
          </ManagementEmptyState>
        </ManagementSection>

        <ManagementSection
          title="Organizer notes"
          description="Private staff notes for event organizers."
        >
          <div className="grid gap-3">
            {event.staff
              .filter(staff => staff.hacker?.id)
              .map(staff => (
                <OrganizerNotePanel
                  hackerId={staff.hacker!.id!}
                  key={staff.id}
                  title={`Organizer note for ${staff.hacker?.name || 'staff member'}`}
                />
              ))}
            {event.staff.filter(staff => staff.hacker?.id).length === 0 && (
              <ManagementEmptyState>
                No staff notes are available.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className={classes.primaryButton}
            onClick={saveSettings}
            type="button"
          >
            Save settings
          </button>
          {message && (
            <ManagementAlert
              tone={message.startsWith('Unable') ? 'danger' : 'success'}
            >
              {message}
            </ManagementAlert>
          )}
        </div>
      </div>
    </ManagementPage>
  );
}
