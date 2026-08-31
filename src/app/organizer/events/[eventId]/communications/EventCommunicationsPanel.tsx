'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type {
  EventCommunicationAudience,
  EventCommunicationChannel,
  EventCommunicationPreview,
} from '@/types/event-workspace';

type ProviderState = {
  available: boolean;
  reason?: string;
};

type CommunicationSummary = {
  id: string;
  channel: EventCommunicationChannel;
  status: string;
  subject: string | null;
  body: string;
  audienceType: EventCommunicationAudience;
  creator?: { id: string; name: string } | null;
  sender?: { id: string; name: string } | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
};

type CommunicationDetail = CommunicationSummary & {
  audienceDefinition?: Record<string, unknown>;
  recipients: Array<{
    id: string;
    displayName: string;
    contactValue: string;
    status: string;
    errorMessage?: string | null;
  }>;
};

type RegistrationAudience = Exclude<
  EventCommunicationAudience,
  'ACTIVE_REGISTERED' | 'SELECTED'
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

export default function EventCommunicationsPanel({
  eventId,
}: {
  eventId: string;
}) {
  const classes = useManagementClasses();
  const [history, setHistory] = useState<CommunicationSummary[]>([]);
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
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draftPreviews, setDraftPreviews] = useState<DraftPreview[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<CommunicationDetail | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetch(`/api/events/${eventId}/blasts`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load communications');
        return response.json() as Promise<{
          items?: CommunicationSummary[];
          providerAvailability?: {
            email: ProviderState;
            sms: ProviderState;
          };
        }>;
      })
      .then(payload => {
        if (!isCurrent) return;
        setHistory(payload.items ?? []);
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
    const audienceType = selectedAudiences[0];
    const previews = await Promise.all(
      channels.map(async channel => {
        const draftResponse = await fetch(`/api/events/${eventId}/blasts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            channel,
            subject: channel === 'EMAIL' ? subject : null,
            body,
            audienceType,
            audienceDefinition: { statuses: selectedAudiences },
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
        setNotice('Message delivery failed. You can retry safely.');
        return;
      }
      setHistory(current => [
        ...results.map(result => result.payload as CommunicationSummary),
        ...current,
      ]);
      setDraftPreviews([]);
      setNotice('Communication sent.');
    } finally {
      setSending(false);
    }
  }

  async function viewDetail(id: string) {
    const response = await fetch(`/api/events/${eventId}/blasts/${id}`);
    if (!response.ok) {
      setNotice('Communication details are unavailable.');
      return;
    }
    setDetail((await response.json()) as CommunicationDetail);
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

        {notice && (
          <ManagementAlert
            tone={notice.includes('sent') ? 'success' : 'danger'}
          >
            <span role="status">{notice}</span>
          </ManagementAlert>
        )}

        <div className={`${classes.subtlePanel} space-y-5 p-4 sm:p-5`}>
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
        </div>

        {draftPreviews.length > 0 && (
          <div className={`${classes.subtlePanel} mt-5 p-4 sm:p-5`}>
            <h3 className="font-bold">Confirm audience</h3>
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

      <ManagementSection title="Communication history">
        {history.length === 0 ? (
          <ManagementEmptyState>
            No communications have been sent.
          </ManagementEmptyState>
        ) : (
          <ul className="space-y-3">
            {history.map(item => (
              <li className={`${classes.subtlePanel} p-4`} key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">
                      {item.subject ?? 'SMS message'}
                    </h3>
                    <p className={`mt-1 text-sm ${classes.mutedText}`}>
                      {item.sender?.name ?? item.creator?.name ?? 'Organizer'} ·{' '}
                      {item.recipientCount} recipients
                    </p>
                    <p className={`mt-1 text-sm ${classes.mutedText}`}>
                      {item.sentCount} sent · {item.failedCount} failed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ManagementBadge>{item.status}</ManagementBadge>
                    <button
                      className={classes.secondaryButton}
                      onClick={() => viewDetail(item.id)}
                      type="button"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ManagementSection>

      {detail && (
        <ManagementSection
          title={detail.subject ?? 'SMS message details'}
          description="Sent content, audience, and recipient outcomes are immutable."
        >
          <p className="whitespace-pre-wrap">{detail.body}</p>
          <ul className="mt-4 space-y-2">
            {detail.recipients.map(recipient => (
              <li className={`${classes.subtlePanel} p-3`} key={recipient.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold">{recipient.displayName}</p>
                    <p className={`text-sm ${classes.mutedText}`}>
                      {recipient.contactValue}
                    </p>
                    {recipient.errorMessage && (
                      <p className="mt-1 text-sm text-red-700">
                        {recipient.errorMessage}
                      </p>
                    )}
                  </div>
                  <ManagementBadge>{recipient.status}</ManagementBadge>
                </div>
              </li>
            ))}
          </ul>
        </ManagementSection>
      )}
    </div>
  );
}
