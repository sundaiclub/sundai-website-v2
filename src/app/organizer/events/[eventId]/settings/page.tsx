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
import type {
  JsonObject,
  OrganizerEventSettings,
} from '@/types/event-management';

function stringFromDetails(
  details: JsonObject | null | undefined,
  key: string
) {
  const value = details?.[key];
  return typeof value === 'string' ? value : '';
}

function formatClosedAt(value?: string | Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function OrganizerEventSettingsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const [event, setEvent] = useState<OrganizerEventSettings | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [applicationMode, setApplicationMode] = useState('REQUIRES_APPROVAL');
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  const [autoPromoteWaitlist, setAutoPromoteWaitlist] = useState(false);
  const [approvedAddress, setApprovedAddress] = useState('');
  const [doorCode, setDoorCode] = useState('');
  const [toolkitUrl, setToolkitUrl] = useState('');
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
        setDescription(payload.description ?? '');
        setPublicLocation(payload.publicLocation ?? '');
        setApplicationMode(payload.applicationMode ?? 'REQUIRES_APPROVAL');
        setApplicationsOpen(payload.applicationsOpen !== false);
        setAutoPromoteWaitlist(Boolean(payload.autoPromoteWaitlist));
        setApprovedAddress(
          stringFromDetails(payload.approvedDetailsJson, 'address')
        );
        setDoorCode(stringFromDetails(payload.approvedDetailsJson, 'doorCode'));
        setToolkitUrl(
          stringFromDetails(payload.approvedDetailsJson, 'toolkitUrl')
        );
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
      body: JSON.stringify({
        title,
        description,
        publicLocation,
        applicationMode,
        applicationsOpen,
        autoPromoteWaitlist,
        approvedDetailsJson: {
          address: approvedAddress,
          doorCode,
          toolkitUrl,
        },
      }),
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

  const staffMembers = event.staff ?? [];
  const closedAt = formatClosedAt(event.applicationsClosedAt);

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
            {event.status && <ManagementBadge>{event.status}</ManagementBadge>}
            {event.visibility && (
              <ManagementBadge>{event.visibility}</ManagementBadge>
            )}
            <ManagementBadge>{applicationMode}</ManagementBadge>
          </>
        }
      />
      <div className="grid gap-5">
        <ManagementSection title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Title</span>
              <input
                aria-label="Title"
                className={classes.input}
                onChange={event => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Application mode</span>
              <select
                aria-label="Application mode"
                className={classes.input}
                onChange={event => setApplicationMode(event.target.value)}
                value={applicationMode}
              >
                <option value="REQUIRES_APPROVAL">REQUIRES_APPROVAL</option>
                <option value="OPEN_RSVP">OPEN_RSVP</option>
              </select>
              <span className={`text-xs ${classes.mutedText}`}>
                {applicationMode === 'OPEN_RSVP'
                  ? 'Open RSVP'
                  : 'Requires approval'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                aria-label="Applications open"
                checked={applicationsOpen}
                className={classes.checkbox}
                onChange={event => setApplicationsOpen(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold">
                {applicationsOpen ? 'Applications open' : 'Applications closed'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                aria-label="Auto-promote waitlist"
                checked={autoPromoteWaitlist}
                className={classes.checkbox}
                onChange={event => setAutoPromoteWaitlist(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold">
                Auto-promote waitlist
              </span>
            </label>
            <div className={`text-sm ${classes.mutedText}`}>
              Capacity {event.capacity ?? 'unlimited'}
              {event.approvedCount !== undefined
                ? `, ${event.approvedCount} approved`
                : ''}
            </div>
            {!applicationsOpen && (
              <div className={`text-sm ${classes.mutedText}`}>
                Applications closed
                {closedAt ? ` ${closedAt}` : ''}
                {event.applicationsCloseReason
                  ? `: ${event.applicationsCloseReason}`
                  : ''}
              </div>
            )}
          </div>
        </ManagementSection>

        <ManagementSection title="Public details">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Public description</span>
              <textarea
                aria-label="Public description"
                className={classes.textarea}
                onChange={event => setDescription(event.target.value)}
                value={description}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Public location</span>
              <input
                aria-label="Public location"
                className={classes.input}
                onChange={event => setPublicLocation(event.target.value)}
                value={publicLocation}
              />
            </label>
          </div>
        </ManagementSection>

        <ManagementSection title="Approved-only details">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Approved-only address
              </span>
              <input
                aria-label="Approved-only address"
                className={classes.input}
                onChange={event => setApprovedAddress(event.target.value)}
                value={approvedAddress}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Door code</span>
              <input
                aria-label="Door code"
                className={classes.input}
                onChange={event => setDoorCode(event.target.value)}
                value={doorCode}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Toolkit URL</span>
              <input
                aria-label="Toolkit"
                className={classes.input}
                onChange={event => setToolkitUrl(event.target.value)}
                value={toolkitUrl}
              />
            </label>
          </div>
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
            {staffMembers.map(staff => (
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
            {staffMembers.length === 0 && (
              <ManagementEmptyState>
                No staff has been assigned.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection
          title="Organizer notes"
          description="Private staff notes for event organizers."
        >
          <div className="grid gap-3">
            {staffMembers
              .filter(staff => staff.hacker?.id)
              .map(staff => (
                <OrganizerNotePanel
                  hackerId={staff.hacker!.id!}
                  key={staff.id}
                  title={`Organizer note for ${staff.hacker?.name || 'staff member'}`}
                />
              ))}
            {staffMembers.filter(staff => staff.hacker?.id).length === 0 && (
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
