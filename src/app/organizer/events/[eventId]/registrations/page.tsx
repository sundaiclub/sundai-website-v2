'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
} from '../../../../components/ManagementSurface';
import {
  RegistrationReviewQueue,
  RegistrationReviewTabs,
} from '../../../../components/RegistrationReviewQueue';
import { useUserContext } from '../../../../contexts/UserContext';
import type {
  OrganizerEventSettings,
  OrganizerRegistrationReviewRow,
  OrganizerRegistrationReviewState,
  OrganizerReviewRole,
  RegistrationStatus,
} from '@/types/event-management';

function normalizeReviewState(
  payload: unknown,
  eventId: string,
  statusFilter: RegistrationStatus,
  includeBannedUsers: boolean,
  viewerRole: OrganizerReviewRole
): OrganizerRegistrationReviewState {
  if (Array.isArray(payload)) {
    return {
      eventId,
      statusFilter,
      includeBannedUsers,
      viewerRole,
      rows: payload as OrganizerRegistrationReviewRow[],
    };
  }

  const value = payload as Partial<OrganizerRegistrationReviewState> | null;
  return {
    eventId,
    statusFilter,
    includeBannedUsers,
    viewerRole,
    rows: value?.rows ?? [],
  };
}

export default function OrganizerEventRegistrationsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const { isAdmin } = useUserContext();
  const [event, setEvent] = useState<OrganizerEventSettings | null>(null);
  const [state, setState] = useState<OrganizerRegistrationReviewState | null>(
    null
  );
  const [statusFilter, setStatusFilter] =
    useState<RegistrationStatus>('PENDING');
  const [includeBannedUsers, setIncludeBannedUsers] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setLoadError('');

    async function load() {
      try {
        const [eventResponse, registrationsResponse] = await Promise.all([
          fetch(`/api/events/${params.eventId}?management=true`),
          fetch(
            `/api/events/${params.eventId}/registrations?status=${statusFilter}${
              includeBannedUsers ? '&includeBannedUsers=true' : ''
            }`
          ),
        ]);
        if (!eventResponse.ok || !registrationsResponse.ok) {
          throw new Error('Unable to load registrations.');
        }
        const [eventPayload, registrationsPayload] = await Promise.all([
          eventResponse.json() as Promise<OrganizerEventSettings>,
          registrationsResponse.json() as Promise<unknown>,
        ]);
        if (!isCurrent) return;
        setEvent(eventPayload);
        setState(
          normalizeReviewState(
            registrationsPayload,
            params.eventId,
            statusFilter,
            includeBannedUsers,
            isAdmin ? 'SITE_ADMIN' : 'MC'
          )
        );
      } catch {
        if (isCurrent) setLoadError('Unable to load registrations.');
      }
    }

    load();

    return () => {
      isCurrent = false;
    };
  }, [includeBannedUsers, isAdmin, params.eventId, statusFilter]);

  async function decide(
    row: OrganizerRegistrationReviewRow,
    status: RegistrationStatus
  ) {
    await fetch(`/api/events/${params.eventId}/registrations/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function saveNotes(row: OrganizerRegistrationReviewRow, notes: string) {
    await fetch(`/api/events/${params.eventId}/registrations/${row.id}/notes`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ internalReviewNotes: notes }),
    });
  }

  return (
    <ManagementPage maxWidth="max-w-6xl">
      <div className="mb-4">
        <ManagementBackButton />
      </div>
      <ManagementHeader
        eyebrow="Organizer"
        title={`${event?.title ?? 'Event'} registrations`}
        description="Review applications, organizer-only context, and registration decisions."
        actions={
          isAdmin ? (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                checked={includeBannedUsers}
                onChange={event => setIncludeBannedUsers(event.target.checked)}
                type="checkbox"
              />
              Include banned users
            </label>
          ) : null
        }
      />
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      <ManagementSection title="Registration queue">
        <div className="mb-5">
          <RegistrationReviewTabs
            activeStatus={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <RegistrationReviewQueue
          onDecision={decide}
          onSaveNotes={saveNotes}
          rows={state?.rows ?? []}
        />
      </ManagementSection>
    </ManagementPage>
  );
}
