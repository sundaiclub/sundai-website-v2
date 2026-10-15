'use client';

import { useState } from 'react';
import {
  ManagementAlert,
  useManagementClasses,
} from '../../components/ManagementSurface';

type CheckInState =
  | { kind: 'ready' }
  | { kind: 'pending' }
  | { kind: 'checked-in'; message: string }
  | { kind: 'error'; message: string };

function formatTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export default function CheckInButton({
  attendeeName,
  eventId,
  registrationId,
  timezone,
}: {
  attendeeName: string;
  eventId: string;
  registrationId: string;
  timezone: string;
}) {
  const classes = useManagementClasses();
  const [state, setState] = useState<CheckInState>({ kind: 'ready' });

  async function checkIn() {
    setState({ kind: 'pending' });
    try {
      const response = await fetch(`/api/events/${eventId}/check-ins`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        setState({
          kind: 'checked-in',
          message: `${attendeeName} checked in at ${formatTime(
            body.checkedInAt,
            timezone
          )}.`,
        });
        return;
      }
      if (body?.reason === 'ALREADY_CHECKED_IN' && body.checkedInAt) {
        setState({
          kind: 'checked-in',
          message: `${attendeeName} was already checked in at ${formatTime(
            body.checkedInAt,
            timezone
          )}.`,
        });
        return;
      }
      setState({
        kind: 'error',
        message: body?.message ?? 'Unable to check in this attendee.',
      });
    } catch {
      setState({ kind: 'error', message: 'Unable to check in this attendee.' });
    }
  }

  if (state.kind === 'checked-in') {
    return (
      <ManagementAlert tone="success">
        <span role="status">{state.message}</span>
      </ManagementAlert>
    );
  }

  return (
    <div className="grid gap-3">
      {state.kind === 'error' && (
        <ManagementAlert tone="danger">
          <span role="alert">{state.message}</span>
        </ManagementAlert>
      )}
      <button
        className={`${classes.primaryButton} min-h-14 w-full text-base`}
        disabled={state.kind === 'pending'}
        onClick={() => void checkIn()}
        type="button"
      >
        {state.kind === 'pending' ? 'Checking in…' : `Check in ${attendeeName}`}
      </button>
    </div>
  );
}
