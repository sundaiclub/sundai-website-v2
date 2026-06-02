'use client';

import { useEffect, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';

export default function OrganizerNewEventPage() {
  const classes = useManagementClasses();
  const [title, setTitle] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [message, setMessage] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    setIsCheckingAccess(true);
    setAuthStatus(null);
    fetch('/api/events?organizer=true')
      .then(response => {
        const nextAuthStatus = authStatusFromResponse(response);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return;
        }

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
      })
      .catch(() => {
        if (isCurrent) setMessage('Unable to verify event permissions.');
      })
      .finally(() => {
        if (isCurrent) setIsCheckingAccess(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        chapterId,
        startTime,
        visibility: 'PUBLIC',
        applicationMode: 'NONE',
      }),
    });
    const nextAuthStatus = authStatusFromResponse(response);
    if (nextAuthStatus) {
      setAuthStatus(nextAuthStatus);
      return;
    }

    setMessage(response.ok ? 'Event saved' : 'Unable to save event');
  }

  if (isCheckingAccess) {
    return (
      <ManagementPage maxWidth="max-w-3xl">
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage maxWidth="max-w-3xl">
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-3xl">
      <div className="mb-4">
        <ManagementBackButton />
      </div>
      <ManagementHeader
        eyebrow="Organizer"
        title="New event"
        description="Create the draft event shell before configuring staff and application settings."
      />
      <ManagementSection title="Event details">
        <form onSubmit={createEvent} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Title</span>
            <input
              aria-label="Title"
              className={classes.input}
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Title"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Chapter ID</span>
            <input
              aria-label="Chapter ID"
              className={classes.input}
              value={chapterId}
              onChange={event => setChapterId(event.target.value)}
              placeholder="chapter-boston"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Start time</span>
            <input
              aria-label="Start time"
              className={classes.input}
              value={startTime}
              onChange={event => setStartTime(event.target.value)}
              placeholder="2026-05-25T18:00:00.000Z"
            />
          </label>
          <button className={classes.primaryButton} type="submit">
            Save draft
          </button>
          {message && (
            <ManagementAlert
              tone={message.startsWith('Unable') ? 'danger' : 'success'}
            >
              {message}
            </ManagementAlert>
          )}
        </form>
      </ManagementSection>
    </ManagementPage>
  );
}
