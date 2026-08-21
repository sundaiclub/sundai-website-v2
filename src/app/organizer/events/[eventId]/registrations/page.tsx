'use client';

import { useEffect, useState, use } from 'react';
import {
  ManagementAlert,
  ManagementSection,
} from '../../../../components/ManagementSurface';
import {
  RegistrationReviewQueue,
  RegistrationReviewTabs,
} from '../../../../components/RegistrationReviewQueue';
import { useUserContext } from '../../../../contexts/UserContext';
import type {
  OrganizerRegistrationReviewRow,
  OrganizerRegistrationReviewState,
  OrganizerReviewRole,
  RegistrationStatus,
} from '@/types/event-management';
import type { EventWorkspacePayload } from '../WorkspaceShell';

type OrganizerRegistrationsPayload =
  | OrganizerRegistrationReviewRow[]
  | Partial<OrganizerRegistrationReviewState>
  | null;

function normalizeReviewState(
  payload: OrganizerRegistrationsPayload,
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
      counts: { [statusFilter]: payload.length },
      rows: payload as OrganizerRegistrationReviewRow[],
    };
  }

  const value = payload as Partial<OrganizerRegistrationReviewState> | null;
  return {
    eventId,
    statusFilter,
    includeBannedUsers,
    viewerRole: value?.viewerRole ?? viewerRole,
    counts: value?.counts ?? {},
    rows: value?.rows ?? [],
  };
}

export default function OrganizerEventRegistrationsPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const params = use(props.params);
  const { isAdmin } = useUserContext();
  const [workspace, setWorkspace] = useState<EventWorkspacePayload | null>(
    null
  );
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
        const [workspaceResponse, registrationsResponse] = await Promise.all([
          fetch(`/api/events/${params.eventId}/workspace`),
          fetch(
            `/api/events/${params.eventId}/registrations?status=${statusFilter}${
              includeBannedUsers ? '&includeBannedUsers=true' : ''
            }`
          ),
        ]);
        if (!workspaceResponse.ok || !registrationsResponse.ok) {
          throw new Error('Unable to load registrations.');
        }
        const [workspacePayload, registrationsPayload] = await Promise.all([
          workspaceResponse.json() as Promise<EventWorkspacePayload>,
          registrationsResponse.json() as Promise<OrganizerRegistrationsPayload>,
        ]);
        if (!isCurrent) return;
        setWorkspace(workspacePayload);
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
    if (!workspace?.capabilities.decideApplicants) return;

    const response = await fetch(
      `/api/events/${params.eventId}/registrations/${row.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    if (!response.ok) return;

    setState(current =>
      current
        ? {
            ...current,
            counts: {
              ...current.counts,
              [row.status]: Math.max(0, (current.counts[row.status] ?? 1) - 1),
              [status]: (current.counts[status] ?? 0) + 1,
            },
            rows: current.rows.filter(currentRow => currentRow.id !== row.id),
          }
        : current
    );
  }

  async function saveNotes(row: OrganizerRegistrationReviewRow, notes: string) {
    const response = await fetch(
      `/api/events/${params.eventId}/registrations/${row.id}/notes`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ internalReviewNotes: notes }),
      }
    );
    if (!response.ok) throw new Error('Unable to save internal review notes.');
  }

  return (
    <ManagementSection
      title="Registration queue"
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
    >
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      <div className="mb-5">
        <RegistrationReviewTabs
          activeStatus={statusFilter}
          counts={state?.counts ?? {}}
          onChange={setStatusFilter}
        />
      </div>
      <RegistrationReviewQueue
        onDecision={decide}
        onSaveNotes={saveNotes}
        rows={state?.rows ?? []}
      />
    </ManagementSection>
  );
}
