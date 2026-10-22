'use client';

import { useEffect, useState } from 'react';
import { HackerSelector } from '../../../../components/HackerSelector';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { HackerSelectionOption } from '@/types/hacker';
import type { EventJudgeSummary, EventJudgingConfig } from '@/types/judging';

type InviteDelivery = {
  sent: boolean;
  message: string | null;
  devLink: string | null;
};

type Notice = {
  tone: 'success' | 'danger' | 'warning';
  text: string;
  devLink?: string | null;
};

function deliveryNotice(email: string, delivery: InviteDelivery): Notice {
  return delivery.sent
    ? { tone: 'success', text: `Judging invite sent to ${email}.` }
    : {
        tone: 'warning',
        text: `Saved, but the invite email to ${email} was not sent: ${delivery.message}`,
        devLink: delivery.devLink,
      };
}

function judgeStatus(judge: EventJudgeSummary) {
  if (judge.revokedAt) return { label: 'Revoked', tone: 'danger' as const };
  if (judge.lastSeenAt) return { label: 'Active', tone: 'success' as const };
  return { label: 'Invited', tone: 'default' as const };
}

function TrackCheckboxes({
  tracks,
  selected,
  onChange,
  disabled,
  labelPrefix,
}: {
  tracks: EventJudgingConfig['tracks'];
  selected: string[];
  onChange: (trackIds: string[]) => void;
  disabled?: boolean;
  labelPrefix: string;
}) {
  const classes = useManagementClasses();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {tracks.map(track => (
        <label className="flex items-center gap-2 text-sm" key={track.id}>
          <input
            aria-label={`${labelPrefix} ${track.name}`}
            checked={selected.includes(track.id)}
            className={classes.checkbox}
            disabled={disabled}
            onChange={event =>
              onChange(
                event.target.checked
                  ? [...selected, track.id]
                  : selected.filter(id => id !== track.id)
              )
            }
            type="checkbox"
          />
          {track.name}
        </label>
      ))}
    </div>
  );
}

export default function JudgesManager({
  eventId,
  config,
  onChanged,
}: {
  eventId: string;
  config: EventJudgingConfig;
  onChanged: (config: EventJudgingConfig) => void;
}) {
  const classes = useManagementClasses();
  const [mode, setMode] = useState<'user' | 'email'>('user');
  const [hackers, setHackers] = useState<HackerSelectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [selectedHacker, setSelectedHacker] =
    useState<HackerSelectionOption | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    fetch('/api/hackers')
      .then(response => (response.ok ? response.json() : []))
      .then(payload => setHackers(Array.isArray(payload) ? payload : []))
      .catch(() => setHackers([]));
  }, []);

  async function request(
    key: string,
    url: string,
    init: RequestInit,
    describe: (body: {
      config?: EventJudgingConfig;
      delivery?: InviteDelivery;
    }) => Notice | null
  ) {
    setPending(key);
    setNotice(null);
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'content-type': 'application/json' },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          tone: 'danger',
          text: body?.message ?? 'Unable to update judges.',
        });
        return false;
      }
      onChanged(body?.config ?? body);
      setNotice(describe(body ?? {}));
      return true;
    } catch {
      setNotice({ tone: 'danger', text: 'Unable to update judges.' });
      return false;
    } finally {
      setPending(null);
    }
  }

  async function invite() {
    const inviteEmail = mode === 'user' ? selectedHacker?.email : email;
    const ok = await request(
      'invite',
      `/api/events/${eventId}/judging/judges`,
      {
        method: 'POST',
        body: JSON.stringify(
          mode === 'user'
            ? { hackerId: selectedHacker?.id, trackIds }
            : { email, name, trackIds }
        ),
      },
      body =>
        body.delivery
          ? deliveryNotice(inviteEmail ?? 'the judge', body.delivery)
          : null
    );
    if (ok) {
      setSelectedHacker(null);
      setQuery('');
      setEmail('');
      setName('');
    }
  }

  const activeJudgeHackerIds = new Set(
    config.judges
      .filter(judge => !judge.revokedAt && judge.hackerId)
      .map(judge => judge.hackerId)
  );
  const normalizedQuery = query.trim().toLowerCase();
  const judgeCandidates = hackers.filter(
    hacker =>
      !activeJudgeHackerIds.has(hacker.id) &&
      (!normalizedQuery ||
        hacker.name.toLowerCase().includes(normalizedQuery) ||
        (hacker.email ?? '').toLowerCase().includes(normalizedQuery))
  );

  const canInvite =
    !config.judgingAssignmentsPublishedAt &&
    trackIds.length > 0 &&
    (mode === 'user' ? Boolean(selectedHacker) : email.trim().length > 0);
  const activeJudges = config.judges.filter(judge => !judge.revokedAt);
  const revokedJudges = config.judges.filter(judge => judge.revokedAt);

  if (config.tracks.length === 0) {
    return (
      <ManagementSection title="Judges">
        <ManagementEmptyState>
          Add tracks in Setup before inviting judges.
        </ManagementEmptyState>
      </ManagementSection>
    );
  }

  return (
    <div className="grid gap-5">
      {config.judgingAssignmentsPublishedAt && (
        <ManagementAlert>
          Scoring has started. The judge list and track assignments are fixed.
        </ManagementAlert>
      )}
      <ManagementSection
        title="Invite a judge"
        description="Judges get an email with a personal link that opens the judging page. They don't need an account."
      >
        <div className="grid gap-4">
          <div className="flex gap-2" role="radiogroup" aria-label="Invite by">
            {(['user', 'email'] as const).map(option => (
              <button
                aria-checked={mode === option}
                className={
                  mode === option
                    ? classes.primaryButton
                    : classes.secondaryButton
                }
                key={option}
                onClick={() => setMode(option)}
                role="radio"
                type="button"
              >
                {option === 'user' ? 'Existing user' : 'Email address'}
              </button>
            ))}
          </div>
          {mode === 'user' ? (
            <div className="grid gap-2">
              <HackerSelector
                filteredHackers={judgeCandidates}
                handleAddMember={hacker =>
                  setSelectedHacker(current =>
                    current?.id === hacker.id ? null : hacker
                  )
                }
                inline
                isDarkMode={classes.isDarkMode}
                searchPlaceholder="Search by name or email"
                searchTerm={query}
                selectedIds={selectedHacker ? [selectedHacker.id] : []}
                setSearchTerm={setQuery}
                setShowModal={() => undefined}
                showModal
                singleSelect
                title="Judge"
              />
              <p className={`text-sm ${classes.mutedText}`}>
                {selectedHacker
                  ? `Selected: ${selectedHacker.name}${selectedHacker.email ? ` (${selectedHacker.email})` : ''}`
                  : 'Select a user to invite.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                aria-label="Judge email"
                className={classes.input}
                onChange={event => setEmail(event.target.value)}
                placeholder="judge@example.com"
                type="email"
                value={email}
              />
              <input
                aria-label="Judge name"
                className={classes.input}
                onChange={event => setName(event.target.value)}
                placeholder="Name (optional)"
                value={name}
              />
            </div>
          )}
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Tracks to judge</span>
            <TrackCheckboxes
              labelPrefix="Invite to judge"
              onChange={setTrackIds}
              selected={trackIds}
              tracks={config.tracks}
            />
          </div>
          <div>
            <button
              className={classes.primaryButton}
              disabled={!canInvite || pending === 'invite'}
              onClick={invite}
              type="button"
            >
              {pending === 'invite' ? 'Inviting…' : 'Send invite'}
            </button>
          </div>
        </div>
      </ManagementSection>

      {notice && (
        <ManagementAlert tone={notice.tone}>
          <span role="status">{notice.text}</span>
          {notice.devLink && (
            <span className="mt-2 block break-all">
              Development link:{' '}
              <a className="underline" href={notice.devLink}>
                {notice.devLink}
              </a>
            </span>
          )}
        </ManagementAlert>
      )}

      <ManagementSection
        title="Judges"
        description="Changing tracks takes effect immediately. Resending issues a new link and the previous one stops working."
      >
        <div className="grid gap-3">
          {activeJudges.length === 0 && (
            <ManagementEmptyState>No judges invited yet.</ManagementEmptyState>
          )}
          {[...activeJudges, ...revokedJudges].map(judge => {
            const status = judgeStatus(judge);
            const label = judge.name || judge.email;
            return (
              <div
                className={`${classes.subtlePanel} grid gap-3 p-4`}
                key={judge.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold">{label}</p>
                    {judge.name && (
                      <p className={`text-sm ${classes.mutedText}`}>
                        {judge.email}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ManagementBadge tone={status.tone}>
                        {status.label}
                      </ManagementBadge>
                      <ManagementBadge>
                        {judge.reviewCount}{' '}
                        {judge.reviewCount === 1
                          ? 'project scored'
                          : 'projects scored'}
                      </ManagementBadge>
                      {judge.hackerId && (
                        <ManagementBadge>Has account</ManagementBadge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {judge.revokedAt ? null : (
                      <>
                        <button
                          className={classes.secondaryButton}
                          disabled={pending === judge.id}
                          onClick={() =>
                            request(
                              judge.id,
                              `/api/events/${eventId}/judging/judges/${judge.id}/resend`,
                              { method: 'POST' },
                              body =>
                                body.delivery
                                  ? deliveryNotice(judge.email, body.delivery)
                                  : null
                            )
                          }
                          type="button"
                        >
                          Resend invite
                        </button>
                        <button
                          aria-label={`Revoke ${label}`}
                          className={classes.ghostButton}
                          disabled={pending === judge.id}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Revoke judging access for ${label}? Their scores are kept.`
                              )
                            ) {
                              return;
                            }
                            request(
                              judge.id,
                              `/api/events/${eventId}/judging/judges/${judge.id}`,
                              { method: 'DELETE' },
                              () => ({
                                tone: 'success',
                                text: `${label} can no longer judge. Their scores are kept.`,
                              })
                            );
                          }}
                          type="button"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {!judge.revokedAt && (
                  <TrackCheckboxes
                    disabled={
                      pending === judge.id ||
                      Boolean(config.judgingAssignmentsPublishedAt)
                    }
                    labelPrefix={`${label} judges`}
                    onChange={nextTrackIds => {
                      if (nextTrackIds.length === 0) {
                        setNotice({
                          tone: 'danger',
                          text: 'A judge needs at least one track. Revoke them instead.',
                        });
                        return;
                      }
                      request(
                        judge.id,
                        `/api/events/${eventId}/judging/judges/${judge.id}`,
                        {
                          method: 'PATCH',
                          body: JSON.stringify({ trackIds: nextTrackIds }),
                        },
                        () => ({
                          tone: 'success',
                          text: `Updated tracks for ${label}.`,
                        })
                      );
                    }}
                    selected={judge.trackIds}
                    tracks={config.tracks}
                  />
                )}
              </div>
            );
          })}
        </div>
      </ManagementSection>
    </div>
  );
}
