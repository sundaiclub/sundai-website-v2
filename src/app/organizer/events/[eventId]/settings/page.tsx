'use client';

import { useEffect, useState } from 'react';
import { ManagementAlert } from '../../../../components/ManagementSurface';
import { OrganizerEventForm } from '../../EventForm';
import type { EventWorkspacePayload } from '../WorkspaceShell';

export default function OrganizerEventSettingsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const [access, setAccess] = useState<
    'loading' | 'allowed' | 'denied' | 'unavailable'
  >('loading');

  useEffect(() => {
    let current = true;
    fetch(`/api/events/${params.eventId}/workspace`)
      .then(async response => {
        if (response.status === 401 || response.status === 403) return null;
        if (!response.ok) throw new Error('Unable to load event access');
        return response.json() as Promise<EventWorkspacePayload>;
      })
      .then(workspace => {
        if (!current) return;
        setAccess(
          workspace?.capabilities.editEventSettings ? 'allowed' : 'denied'
        );
      })
      .catch(() => {
        if (current) setAccess('unavailable');
      });
    return () => {
      current = false;
    };
  }, [params.eventId]);

  if (access === 'loading') {
    return (
      <ManagementAlert>
        <span role="status">Checking event access…</span>
      </ManagementAlert>
    );
  }
  if (access === 'denied') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">You do not have permission to edit this event.</span>
      </ManagementAlert>
    );
  }
  if (access === 'unavailable') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">Event settings are unavailable.</span>
      </ManagementAlert>
    );
  }
  return <OrganizerEventForm eventId={params.eventId} />;
}
