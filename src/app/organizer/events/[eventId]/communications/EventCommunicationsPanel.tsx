'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import DeliveryStatsSummary from '../../../../components/DeliveryStatsSummary';
import type {
  EventCommunicationAudience,
  EventCommunicationChannel,
  EventCommunicationHistoryGroup,
  EventCommunicationPreview,
  EventCommunicationStatus,
} from '@/types/event-workspace';

type ProviderState = {
  available: boolean;
  reason?: string;
};

type RegistrationAudience = Exclude<
  EventCommunicationAudience,
  'ACTIVE_REGISTERED' | 'CHAPTER_MEMBERS' | 'SELECTED'
>;

const audiences: Array<{
  value: RegistrationAudience;
  label: string;
}> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'DECLINED', label: 'Declined' },
];

type DraftPreview = {
  id: string;
  preview: EventCommunicationPreview;
};

type ChapterInvitationDefaults = {
  subject: string;
  emailBody: string;
  smsBody: string;
};

type ChapterInvitationStatus = {
  id: string;
  channel: EventCommunicationChannel;
  status: EventCommunicationStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
};

type HistoryPayload = {
  items?: EventCommunicationHistoryGroup[];
  chapterInvitationStatus?: ChapterInvitationStatus | null;
};

const newSendGroupId = () => globalThis.crypto.randomUUID();

export default function EventCommunicationsPanel({
  eventId,
}: {
  eventId: string;
}) {
  const classes = useManagementClasses();
  const [history, setHistory] = useState<EventCommunicationHistoryGroup[]>([]);
  const [providers, setProviders] = useState<{
    email: ProviderState;
    sms: ProviderState;
  }>({
    email: { available: false },
    sms: { available: false },
  });
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [channels, setChannels] = useState<EventCommunicationChannel[]>([
    'EMAIL',
  ]);
  const [selectedAudiences, setSelectedAudiences] = useState<
    RegistrationAudience[]
  >(['APPROVED']);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [allLocations, setAllLocations] = useState(true);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draftPreviews, setDraftPreviews] = useState<DraftPreview[]>([]);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [invitationState, setInvitationState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [invitationContent, setInvitationContent] =
    useState<ChapterInvitationDefaults | null>(null);
  const [invitationPreviews, setInvitationPreviews] = useState<DraftPreview[]>(
    []
  );
  const [invitationNotice, setInvitationNotice] = useState('');
  const [chapterInvitationStatus, setChapterInvitationStatus] =
    useState<ChapterInvitationStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const hasPendingSend = history.some(group =>
    group.communications.some(item => item.status === 'SENDING')
  );

  useEffect(() => {
    let isCurrent = true;
    fetch(`/api/events/${eventId}/blasts`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load communications');
        return response.json() as Promise<
          HistoryPayload & {
            locations?: Array<{ id: string; name: string }>;
            providerAvailability?: {
              email: ProviderState;
              sms: ProviderState;
            };
          }
        >;
      })
      .then(payload => {
        if (!isCurrent) return;
        setHistory(payload.items ?? []);
        setLocations(payload.locations ?? []);
        setChapterInvitationStatus(payload.chapterInvitationStatus ?? null);
        if (payload.providerAvailability) {
          setProviders(payload.providerAvailability);
          setChannels(
            (['EMAIL', 'SMS'] as const).filter(channel =>
              channel === 'EMAIL'
                ? payload.providerAvailability!.email.available
                : payload.providerAvailability!.sms.available
            )
          );
        }
        setLoadState('ready');
      })
      .catch(() => {
        if (isCurrent) setLoadState('error');
      });
    return () => {
      isCurrent = false;
    };
  }, [eventId]);

  async function reloadHistory() {
    const response = await fetch(`/api/events/${eventId}/blasts`);
    if (!response.ok) return null;
    return (await response.json()) as HistoryPayload;
  }

  function applyHistory(payload: HistoryPayload) {
    setHistory(payload.items ?? []);
    setChapterInvitationStatus(payload.chapterInvitationStatus ?? null);
  }

  useEffect(() => {
    if (!hasPendingSend) return;
    let current = true;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/blasts`);
        if (!response.ok) return;
        const payload = (await response.json()) as HistoryPayload;
        if (current) applyHistory(payload);
      } catch {
        /* Keep the last known progress until the next poll. */
      }
    }, 5000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [eventId, hasPendingSend]);

  function toggleChannel(channel: EventCommunicationChannel) {
    setChannels(current =>
      current.includes(channel)
        ? current.filter(value => value !== channel)
        : [...current, channel]
    );
    setDraftPreviews([]);
  }

  function toggleAudience(audience: RegistrationAudience) {
    setSelectedAudiences(current =>
      current.includes(audience)
        ? current.filter(value => value !== audience)
        : [...current, audience]
    );
    setDraftPreviews([]);
  }

  function toggleAllAudiences() {
    setSelectedAudiences(current =>
      current.length === audiences.length
        ? []
        : audiences.map(option => option.value)
    );
    setDraftPreviews([]);
  }

  async function saveAndPreview() {
    setNotice('');
    setDraftPreviews([]);
    setPreviewing(true);
    const audienceType = selectedAudiences[0];
    const sendGroupId = newSendGroupId();
    const previews = await Promise.all(
      channels.map(async channel => {
        const draftResponse = await fetch(`/api/events/${eventId}/blasts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            channel,
            sendGroupId,
            subject: channel === 'EMAIL' ? subject : null,
            body,
            audienceType,
            audienceDefinition: {
              statuses: selectedAudiences,
              ...(!allLocations ? { locationIds } : {}),
            },
          }),
        });
        if (!draftResponse.ok) {
          throw new Error('Unable to save the communication draft.');
        }
        const draft = (await draftResponse.json()) as { id: string };
        const previewResponse = await fetch(
          `/api/events/${eventId}/blasts/${draft.id}/preview`,
          { method: 'POST' }
        );
        if (!previewResponse.ok) {
          throw new Error('Unable to preview this audience.');
        }
        return {
          id: draft.id,
          preview: (await previewResponse.json()) as EventCommunicationPreview,
        };
      })
    ).catch((error: Error) => {
      setNotice(error.message);
      return null;
    });
    if (previews) setDraftPreviews(previews);
    setPreviewing(false);
  }

  async function previewChapterInvitation() {
    setNotice('');
    setInvitationOpen(true);
    setInvitationState('loading');
    setInvitationNotice('');
    setInvitationContent(null);
    setInvitationPreviews([]);
    try {
      const invitationResponse = await fetch(
        `/api/events/${eventId}/blasts/invitation`
      );
      if (!invitationResponse.ok) {
        const payload = await invitationResponse.json().catch(() => null);
        throw new Error(
          payload?.error ?? 'Unable to prepare the chapter invitation.'
        );
      }
      const invitation =
        (await invitationResponse.json()) as ChapterInvitationDefaults;
      setInvitationContent(invitation);
      const availableChannels = (['EMAIL', 'SMS'] as const).filter(channel =>
        channel === 'EMAIL'
          ? providers.email.available
          : providers.sms.available
      );
      if (availableChannels.length === 0) {
        throw new Error('No communication provider is available.');
      }

      const sendGroupId = newSendGroupId();
      const previews = await Promise.all(
        availableChannels.map(async channel => {
          const draftResponse = await fetch(`/api/events/${eventId}/blasts`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              channel,
              sendGroupId,
              subject: channel === 'EMAIL' ? invitation.subject : null,
              body:
                channel === 'EMAIL' ? invitation.emailBody : invitation.smsBody,
              audienceType: 'CHAPTER_MEMBERS',
              audienceDefinition: {},
            }),
          });
          if (!draftResponse.ok) {
            const payload = await draftResponse.json().catch(() => null);
            throw new Error(
              payload?.error ?? 'Unable to save the invitation draft.'
            );
          }
          const draft = (await draftResponse.json()) as { id: string };
          const previewResponse = await fetch(
            `/api/events/${eventId}/blasts/${draft.id}/preview`,
            { method: 'POST' }
          );
          if (!previewResponse.ok) {
            throw new Error('Unable to preview the chapter invitation.');
          }
          return {
            id: draft.id,
            preview:
              (await previewResponse.json()) as EventCommunicationPreview,
          };
        })
      );
      setInvitationPreviews(previews);
      setInvitationState('ready');
    } catch (error) {
      setInvitationNotice(
        error instanceof Error
          ? error.message
          : 'Unable to prepare the chapter invitation.'
      );
      setInvitationState('error');
    }
  }

  function closeChapterInvitation() {
    if (sending) return;
    setInvitationOpen(false);
    setInvitationState('idle');
    setInvitationContent(null);
    setInvitationPreviews([]);
    setInvitationNotice('');
  }

  async function confirmSend() {
    if (draftPreviews.length === 0) return;
    setSending(true);
    setNotice('');
    try {
      const results = await Promise.all(
        draftPreviews.map(async draft => {
          const response = await fetch(
            `/api/events/${eventId}/blasts/${draft.id}/send`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                previewFingerprint: draft.preview.previewFingerprint,
              }),
            }
          );
          return { draft, response, payload: await response.json() };
        })
      );
      const invalidSelection = results.find(
        result => result.response.status === 409 && !result.payload.preview
      );
      if (invalidSelection) {
        setDraftPreviews([]);
        setNotice(
          invalidSelection.payload.error ??
            'Review the location selection and preview again.'
        );
        return;
      }
      const changed = results.filter(result => result.response.status === 409);
      if (changed.length > 0) {
        setDraftPreviews(current =>
          current.map(draft => {
            const replacement = changed.find(
              result => result.draft.id === draft.id
            );
            return replacement
              ? {
                  id: draft.id,
                  preview: replacement.payload
                    .preview as EventCommunicationPreview,
                }
              : draft;
          })
        );
        setNotice(
          'Audience changed. Review the updated audience and confirm again.'
        );
        return;
      }
      if (results.some(result => !result.response.ok)) {
        setNotice(
          'The request failed. Check communication history before sending again.'
        );
        return;
      }
      const updated = await reloadHistory().catch(() => null);
      if (updated) applyHistory(updated);
      setDraftPreviews([]);
      setNotice(
        results.some(result => result.payload.status === 'SENDING')
          ? 'Email queued. Progress will appear in communication history.'
          : 'Communication sent.'
      );
    } finally {
      setSending(false);
    }
  }

  async function confirmChapterInvitation() {
    if (invitationPreviews.length === 0) return;
    setSending(true);
    setInvitationNotice('');
    try {
      const results = await Promise.all(
        invitationPreviews.map(async draft => {
          const response = await fetch(
            `/api/events/${eventId}/blasts/${draft.id}/send`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                previewFingerprint: draft.preview.previewFingerprint,
              }),
            }
          );
          return { draft, response, payload: await response.json() };
        })
      );
      const changed = results.filter(result => result.response.status === 409);
      if (changed.length > 0) {
        setInvitationPreviews(current =>
          current.map(draft => {
            const replacement = changed.find(
              result => result.draft.id === draft.id
            );
            return replacement
              ? {
                  id: draft.id,
                  preview: replacement.payload
                    .preview as EventCommunicationPreview,
                }
              : draft;
          })
        );
        setInvitationNotice(
          'Audience changed. Review the updated audience and confirm again.'
        );
        return;
      }
      if (results.some(result => !result.response.ok)) {
        setInvitationNotice(
          'The request failed. Check communication history before sending again.'
        );
        return;
      }
      const updated = await reloadHistory().catch(() => null);
      if (updated) applyHistory(updated);
      setInvitationOpen(false);
      setInvitationState('idle');
      setInvitationContent(null);
      setInvitationPreviews([]);
      setInvitationNotice('');
      setNotice(
        results.some(result => result.payload.status === 'SENDING')
          ? 'Chapter invitation queued. Progress will appear in communication history.'
          : 'Chapter invitation sent.'
      );
    } finally {
      setSending(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <ManagementAlert>
        <span role="status">Loading communications…</span>
      </ManagementAlert>
    );
  }

  if (loadState === 'error') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">Event communications are unavailable.</span>
      </ManagementAlert>
    );
  }

  return (
    <div className="space-y-5">
      {notice && (
        <ManagementAlert
          tone={
            notice.includes('sent') || notice.includes('queued')
              ? 'success'
              : 'danger'
          }
        >
          <span role="status">{notice}</span>
        </ManagementAlert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {chapterInvitationStatus ? (
          <>
            <ManagementBadge
              tone={
                chapterInvitationStatus.status === 'SENT'
                  ? 'success'
                  : chapterInvitationStatus.status === 'PARTIAL' ||
                      chapterInvitationStatus.status === 'SENDING'
                    ? 'warning'
                    : 'danger'
              }
            >
              {chapterInvitationStatus.status === 'SENT'
                ? 'Invitation sent'
                : chapterInvitationStatus.status === 'SENDING'
                  ? 'Invitation queued or sending'
                  : chapterInvitationStatus.status === 'PARTIAL'
                    ? 'Partially sent'
                    : 'Last send failed'}
            </ManagementBadge>
            <p className={`text-sm ${classes.mutedText}`}>
              {chapterInvitationStatus.sentCount} sent ·{' '}
              {chapterInvitationStatus.failedCount} failed via{' '}
              {chapterInvitationStatus.channel === 'EMAIL' ? 'email' : 'SMS'}
              {chapterInvitationStatus.sentAt
                ? ` on ${new Date(chapterInvitationStatus.sentAt).toLocaleString()}`
                : ''}
            </p>
          </>
        ) : (
          <ManagementBadge>Invitation not sent</ManagementBadge>
        )}
      </div>

      <ManagementSection
        title="Invite chapter members"
        description="Invite all active chapter members to this published event. Email and SMS delivery follows each member’s chapter notification preferences."
        actions={
          <button
            className={classes.primaryButton}
            disabled={
              sending ||
              (!providers.email.available && !providers.sms.available)
            }
            onClick={previewChapterInvitation}
            type="button"
          >
            Invite chapter members
          </button>
        }
      >
        <p className={`text-sm ${classes.mutedText}`}>
          The email includes the event link and a link where members can change
          their notification preferences or unsubscribe.
        </p>
      </ManagementSection>

      <ManagementSection
        title="Communications"
        description="Draft, preview, and send messages to current registration audiences."
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className={`${classes.subtlePanel} p-4`}>
            <p className="font-bold">
              Email {providers.email.available ? 'available' : 'unavailable'}
            </p>
            {providers.email.reason && (
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                {providers.email.reason}
              </p>
            )}
          </div>
          <div className={`${classes.subtlePanel} p-4`}>
            <p className="font-bold">
              SMS {providers.sms.available ? 'available' : 'unavailable'}
            </p>
            {providers.sms.reason && (
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                {providers.sms.reason}
              </p>
            )}
          </div>
        </div>

        <fieldset
          disabled={previewing || sending}
          className={`${classes.subtlePanel} space-y-5 p-4 sm:p-5`}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Channels</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {(['EMAIL', 'SMS'] as const).map(option => {
                  const provider =
                    providers[option === 'EMAIL' ? 'email' : 'sms'];
                  return (
                    <label
                      className={`flex items-center gap-2 text-sm ${
                        provider.available ? '' : classes.mutedText
                      }`}
                      key={option}
                    >
                      <input
                        checked={channels.includes(option)}
                        className={classes.checkbox}
                        disabled={!provider.available}
                        onChange={() => toggleChannel(option)}
                        type="checkbox"
                      />
                      {option === 'EMAIL' ? 'Email' : 'SMS'}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Audience</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={selectedAudiences.length === audiences.length}
                    className={classes.checkbox}
                    onChange={toggleAllAudiences}
                    type="checkbox"
                  />
                  All
                </label>
                {audiences.map(option => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={option.value}
                  >
                    <input
                      checked={selectedAudiences.includes(option.value)}
                      className={classes.checkbox}
                      onChange={() => toggleAudience(option.value)}
                      type="checkbox"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset disabled={previewing || sending}>
            <legend className="mb-2 text-sm font-bold">Locations</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-message-locations"
                  className={classes.checkbox}
                  checked={allLocations}
                  onChange={() => {
                    setAllLocations(true);
                    setDraftPreviews([]);
                  }}
                />
                All locations
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="event-message-locations"
                  className={classes.checkbox}
                  checked={!allLocations}
                  disabled={!locations.length}
                  onChange={() => {
                    setAllLocations(false);
                    setDraftPreviews([]);
                  }}
                />
                Specific locations
              </label>
            </div>
            {!allLocations && (
              <div className="mt-3 flex flex-wrap gap-4">
                {locations.map(location => (
                  <label
                    key={location.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className={classes.checkbox}
                      checked={locationIds.includes(location.id)}
                      onChange={event => {
                        const checked = event.target.checked;
                        setLocationIds(current =>
                          checked
                            ? [...current, location.id]
                            : current.filter(id => id !== location.id)
                        );
                        setDraftPreviews([]);
                      }}
                    />
                    {location.name}
                  </label>
                ))}
              </div>
            )}
            <p className={`mt-2 text-sm ${classes.mutedText}`}>
              {locations.length
                ? 'All locations includes applicants with no location answer. Specific locations includes only matching application answers.'
                : 'An event editor can add message locations in event settings.'}
            </p>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Subject</span>
            <input
              className={`${classes.input} w-full`}
              disabled={!channels.includes('EMAIL')}
              onChange={event => {
                setSubject(event.target.value);
                setDraftPreviews([]);
              }}
              value={subject}
            />
            <span className={`mt-1 block text-xs ${classes.mutedText}`}>
              The subject is only used for emails.
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Message body</span>
            <textarea
              className={`${classes.textarea} w-full resize-y`}
              onChange={event => {
                setBody(event.target.value);
                setDraftPreviews([]);
              }}
              rows={5}
              value={body}
            />
          </label>
          <button
            className={classes.primaryButton}
            disabled={
              previewing ||
              sending ||
              (!allLocations && locationIds.length === 0) ||
              !body.trim() ||
              channels.length === 0 ||
              selectedAudiences.length === 0 ||
              (channels.includes('EMAIL') && !subject.trim())
            }
            onClick={saveAndPreview}
            type="button"
          >
            Save and preview
          </button>
        </fieldset>

        {draftPreviews.length > 0 && (
          <div className={`${classes.subtlePanel} mt-5 p-4 sm:p-5`}>
            <h3 className="font-bold">Confirm audience</h3>
            <p className="mt-2 text-sm">
              Locations:{' '}
              {allLocations
                ? 'All locations'
                : locations
                    .filter(location => locationIds.includes(location.id))
                    .map(location => location.name)
                    .join(', ')}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {draftPreviews.map(({ id, preview }) => (
                <div className="rounded-md border p-3" key={id}>
                  <p className="text-sm font-bold">
                    {preview.channel === 'EMAIL' ? 'Email' : 'SMS'} ·{' '}
                    {preview.eligibleCount} eligible recipients
                  </p>
                  <ul className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}>
                    <li>{preview.exclusions.cancelled} cancelled</li>
                    <li>{preview.exclusions.missingContact} missing contact</li>
                    <li>
                      {preview.exclusions.preferenceDisabled} preference
                      disabled
                    </li>
                    <li>{preview.exclusions.ineligible} ineligible</li>
                  </ul>
                </div>
              ))}
            </div>
            <button
              className={`${classes.primaryButton} mt-4`}
              disabled={sending}
              onClick={confirmSend}
              type="button"
            >
              {sending ? 'Sending…' : 'Confirm and send'}
            </button>
          </div>
        )}
      </ManagementSection>

      <ManagementSection
        title="Communication history"
        description="Email and SMS versions of the same message are shown together. Email delivery and clicks update as SES reports them."
      >
        {history.length === 0 ? (
          <ManagementEmptyState>
            No communications have been sent.
          </ManagementEmptyState>
        ) : (
          <ul className="space-y-3">
            {history.map(group => {
              const isOpen = detailGroupId === group.sendGroupId;
              const email = group.communications.find(
                item => item.channel === 'EMAIL'
              );
              return (
                <li
                  className={`${classes.subtlePanel} p-4`}
                  key={group.sendGroupId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">
                        {email?.subject ?? 'SMS message'}
                      </h3>
                      <p className={`mt-1 text-sm ${classes.mutedText}`}>
                        {group.sender?.name ?? 'Organizer'} ·{' '}
                        {new Date(group.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {group.communications.map(item => (
                        <ManagementBadge
                          key={item.id}
                          tone={
                            item.status === 'SENT'
                              ? 'success'
                              : item.status === 'FAILED'
                                ? 'danger'
                                : item.status === 'DRAFT'
                                  ? 'default'
                                  : 'warning'
                          }
                        >
                          {item.channel === 'EMAIL' ? 'Email' : 'SMS'} ·{' '}
                          {item.status}
                        </ManagementBadge>
                      ))}
                      <button
                        aria-expanded={isOpen}
                        className={classes.secondaryButton}
                        onClick={() =>
                          setDetailGroupId(isOpen ? null : group.sendGroupId)
                        }
                        type="button"
                      >
                        {isOpen ? 'Hide details' : 'View details'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {group.communications.map(item => (
                      <div key={item.id}>
                        {group.communications.length > 1 && (
                          <h4 className="mb-2 text-sm font-bold">
                            {item.channel === 'EMAIL' ? 'Email' : 'SMS'}
                          </h4>
                        )}
                        <DeliveryStatsSummary
                          channel={item.channel}
                          detailed={isOpen}
                          stats={item.stats}
                        />
                      </div>
                    ))}
                  </div>
                  {isOpen && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <p className="text-sm">
                        Locations:{' '}
                        {Array.isArray(group.audienceDefinition?.locationNames)
                          ? group.audienceDefinition.locationNames.join(', ')
                          : 'All locations'}
                      </p>
                      {group.communications.map(item => (
                        <div key={item.id}>
                          <h4 className="text-sm font-bold">
                            {item.channel === 'EMAIL'
                              ? 'Email message'
                              : 'SMS message'}
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {item.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ManagementSection>

      {invitationOpen && (
        <div
          aria-labelledby="chapter-invitation-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
        >
          <div
            className={`${classes.panel} ${
              classes.isDarkMode ? '!bg-gray-900' : '!bg-white'
            } max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold" id="chapter-invitation-title">
                  Confirm chapter invitation
                </h2>
                <p className={`mt-1 text-sm ${classes.mutedText}`}>
                  Review the message and eligible recipients before you send.
                </p>
              </div>
              <button
                className={classes.ghostButton}
                disabled={sending}
                onClick={closeChapterInvitation}
                type="button"
              >
                Close
              </button>
            </div>

            {invitationState === 'loading' && (
              <p className={`mt-5 ${classes.mutedText}`} role="status">
                Preparing invitation…
              </p>
            )}
            {invitationNotice && (
              <div className="mt-5">
                <ManagementAlert tone="danger">
                  <span role="alert">{invitationNotice}</span>
                </ManagementAlert>
              </div>
            )}
            {invitationContent && invitationState === 'ready' && (
              <div className="mt-5 space-y-5">
                {providers.email.available && (
                  <div className={`${classes.subtlePanel} p-4`}>
                    <h3 className="font-bold">Email</h3>
                    <p className="mt-2 text-sm font-semibold">
                      {invitationContent.subject}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {invitationContent.emailBody}
                    </p>
                    <p className={`mt-3 text-xs ${classes.mutedText}`}>
                      The delivered email also includes the event button and the
                      notification-preferences link.
                    </p>
                  </div>
                )}
                {providers.sms.available && (
                  <div className={`${classes.subtlePanel} p-4`}>
                    <h3 className="font-bold">SMS</h3>
                    <p className="mt-2 text-sm">{invitationContent.smsBody}</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {invitationPreviews.map(({ id, preview }) => (
                    <div className="rounded-md border p-3" key={id}>
                      <p className="text-sm font-bold">
                        {preview.channel === 'EMAIL' ? 'Email' : 'SMS'} ·{' '}
                        {preview.eligibleCount} eligible recipients
                      </p>
                      <ul
                        className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}
                      >
                        <li>
                          {preview.exclusions.missingContact} missing contact
                        </li>
                        <li>
                          {preview.exclusions.preferenceDisabled} preference
                          disabled
                        </li>
                        <li>{preview.exclusions.ineligible} ineligible</li>
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    className={classes.secondaryButton}
                    disabled={sending}
                    onClick={closeChapterInvitation}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={classes.primaryButton}
                    disabled={
                      sending ||
                      invitationPreviews.every(
                        draft => draft.preview.eligibleCount === 0
                      )
                    }
                    onClick={confirmChapterInvitation}
                    type="button"
                  >
                    {sending ? 'Sending…' : 'Confirm and send invitation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
