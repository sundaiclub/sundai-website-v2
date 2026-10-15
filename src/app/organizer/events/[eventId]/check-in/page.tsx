'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import { useEventWorkspace } from '../WorkspaceShell';
import type {
  EventCheckInList,
  EventCheckInRow,
} from '@/types/event-workspace';

const SEARCH_DEBOUNCE_MS = 250;

function formatCheckInTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export default function OrganizerEventCheckInPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const { event } = useEventWorkspace();
  const [search, setSearch] = useState('');
  const [payload, setPayload] = useState<EventCheckInList | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const timeout = window.setTimeout(async () => {
      try {
        const query = search.trim()
          ? `?search=${encodeURIComponent(search.trim())}`
          : '';
        const response = await fetch(
          `/api/events/${params.eventId}/check-ins${query}`
        );
        if (!response.ok) throw new Error('Unable to load check-ins.');
        const nextPayload = (await response.json()) as EventCheckInList;
        if (!isCurrent) return;
        setPayload(nextPayload);
        setLoadError('');
      } catch {
        if (isCurrent) setLoadError('Unable to load check-ins.');
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [params.eventId, search]);

  async function checkIn(row: EventCheckInRow) {
    setActionError('');
    setPendingId(row.registrationId);
    try {
      const response = await fetch(`/api/events/${params.eventId}/check-ins`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ registrationId: row.registrationId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok && body?.reason !== 'ALREADY_CHECKED_IN') {
        setActionError(body?.message ?? `Unable to check in ${row.name}.`);
        return;
      }

      const checkedInAt = body?.checkedInAt ?? new Date().toISOString();
      setPayload(current =>
        current
          ? {
              ...current,
              counts: response.ok
                ? {
                    ...current.counts,
                    checkedIn: current.counts.checkedIn + 1,
                  }
                : current.counts,
              rows: current.rows.map(currentRow =>
                currentRow.registrationId === row.registrationId
                  ? {
                      ...currentRow,
                      checkedInAt,
                      checkedInBy: body?.checkedInBy ?? currentRow.checkedInBy,
                    }
                  : currentRow
              ),
            }
          : current
      );
    } catch {
      setActionError(`Unable to check in ${row.name}.`);
    } finally {
      setPendingId(null);
    }
  }

  const counts = payload?.counts;
  const percent =
    counts && counts.approved > 0
      ? Math.round((counts.checkedIn / counts.approved) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <ManagementSection
        title="Check-in"
        description="Scan an attendee's QR code with your phone camera to open their check-in page, or find them below to check them in manually."
      >
        {payload && !payload.trackAttendance && (
          <div className="mb-4">
            <ManagementAlert tone="warning">
              Attendance tracking is off. Turn on “Track attendance” in the
              event settings to enable check-in.
            </ManagementAlert>
          </div>
        )}
        <div className={`${classes.subtlePanel} p-4`}>
          <p className={`text-sm ${classes.mutedText}`}>Checked in</p>
          <p className="mt-1 text-3xl font-bold" aria-live="polite">
            {counts ? `${counts.checkedIn} / ${counts.approved}` : '—'}
          </p>
          <p className={`mt-1 text-sm ${classes.mutedText}`}>
            approved attendees{counts ? ` · ${percent}%` : ''}
          </p>
          <div
            aria-hidden="true"
            className={`mt-3 h-2 overflow-hidden rounded-full ${
              classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
            }`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </ManagementSection>

      <ManagementSection title="Approved attendees">
        <label className="mb-4 grid gap-2">
          <span className="text-sm font-semibold">Search</span>
          <input
            aria-label="Search approved attendees"
            className={classes.input}
            onChange={changeEvent => setSearch(changeEvent.target.value)}
            placeholder="Name, email, or username"
            type="search"
            value={search}
          />
        </label>

        {loadError && (
          <div className="mb-4">
            <ManagementAlert tone="danger">{loadError}</ManagementAlert>
          </div>
        )}
        {actionError && (
          <div className="mb-4">
            <ManagementAlert tone="danger">
              <span role="alert">{actionError}</span>
            </ManagementAlert>
          </div>
        )}

        {payload && payload.rows.length === 0 ? (
          <ManagementEmptyState>
            {search.trim()
              ? 'No approved attendees match that search.'
              : 'No approved attendees yet.'}
          </ManagementEmptyState>
        ) : (
          <ul className={`divide-y ${classes.divider}`} role="list">
            {(payload?.rows ?? []).map(row => (
              <li
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={row.registrationId}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className={`truncate text-sm ${classes.mutedText}`}>
                    {[row.username && `@${row.username}`, row.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {row.checkedInAt ? (
                  <ManagementBadge tone="success">
                    Checked in{' '}
                    {formatCheckInTime(row.checkedInAt, event.timezone)}
                    {row.checkedInBy ? ` by ${row.checkedInBy}` : ''}
                  </ManagementBadge>
                ) : (
                  <button
                    className={classes.primaryButton}
                    disabled={
                      pendingId === row.registrationId ||
                      payload?.trackAttendance === false
                    }
                    onClick={() => void checkIn(row)}
                    type="button"
                  >
                    {pendingId === row.registrationId
                      ? 'Checking in…'
                      : 'Check in'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {payload?.hasMore && (
          <p className={`mt-3 text-sm ${classes.mutedText}`}>
            Showing the first {payload.rows.length} matches. Search to narrow
            the list.
          </p>
        )}
      </ManagementSection>
    </div>
  );
}
