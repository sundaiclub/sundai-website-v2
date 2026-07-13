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

const audiences: Array<{
  value: EventCommunicationAudience;
  label: string;
}> = [
  { value: 'ACTIVE_REGISTERED', label: 'Active registered users' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'SELECTED', label: 'Selected users' },
];

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
  const [channel, setChannel] = useState<EventCommunicationChannel>('EMAIL');
  const [audience, setAudience] =
    useState<EventCommunicationAudience>('APPROVED');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EventCommunicationPreview | null>(
    null
  );
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

  function resetComposer() {
    setChannel('EMAIL');
    setAudience('APPROVED');
    setSubject('');
    setBody('');
    setDraftId(null);
    setPreview(null);
    setNotice('');
  }

  async function saveAndPreview() {
    setNotice('');
    const draftResponse = await fetch(`/api/events/${eventId}/blasts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel,
        subject: channel === 'EMAIL' ? subject : null,
        body,
        audienceType: audience,
        audienceDefinition: {},
      }),
    });
    if (!draftResponse.ok) {
      setNotice('Unable to save the communication draft.');
      return;
    }
    const draft = (await draftResponse.json()) as { id: string };
    setDraftId(draft.id);
    const previewResponse = await fetch(
      `/api/events/${eventId}/blasts/${draft.id}/preview`,
      { method: 'POST' }
    );
    if (!previewResponse.ok) {
      setNotice('Unable to preview this audience.');
      return;
    }
    setPreview((await previewResponse.json()) as EventCommunicationPreview);
  }

  async function confirmSend() {
    if (!draftId || !preview) return;
    setSending(true);
    setNotice('');
    try {
      const response = await fetch(
        `/api/events/${eventId}/blasts/${draftId}/send`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            previewFingerprint: preview.previewFingerprint,
          }),
        }
      );
      const payload = await response.json();
      if (response.status === 409) {
        setPreview(payload.preview as EventCommunicationPreview);
        setNotice(
          'Audience changed. Review the updated audience and confirm again.'
        );
        return;
      }
      if (!response.ok) {
        setNotice('Message delivery failed. You can retry safely.');
        return;
      }
      setHistory(current => [payload as CommunicationSummary, ...current]);
      setPreview(null);
      setDraftId(null);
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
        actions={
          <button
            className={classes.primaryButton}
            onClick={resetComposer}
            type="button"
          >
            New message
          </button>
        }
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

        <div className={`${classes.subtlePanel} space-y-4 p-4`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-bold">Channel</span>
              <select
                className={classes.input}
                onChange={event =>
                  setChannel(event.target.value as EventCommunicationChannel)
                }
                value={channel}
              >
                <option disabled={!providers.email.available} value="EMAIL">
                  Email
                </option>
                <option disabled={!providers.sms.available} value="SMS">
                  SMS
                </option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold">Audience</span>
              <select
                className={classes.input}
                onChange={event =>
                  setAudience(event.target.value as EventCommunicationAudience)
                }
                value={audience}
              >
                {audiences.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {channel === 'EMAIL' && (
            <label>
              <span className="mb-1 block text-sm font-bold">Subject</span>
              <input
                className={classes.input}
                onChange={event => setSubject(event.target.value)}
                value={subject}
              />
            </label>
          )}
          <label>
            <span className="mb-1 block text-sm font-bold">Message body</span>
            <textarea
              className={classes.textarea}
              onChange={event => setBody(event.target.value)}
              rows={5}
              value={body}
            />
          </label>
          <button
            className={classes.primaryButton}
            disabled={
              !body.trim() ||
              (channel === 'EMAIL' && !subject.trim()) ||
              !providers[channel === 'EMAIL' ? 'email' : 'sms'].available
            }
            onClick={saveAndPreview}
            type="button"
          >
            Save and preview
          </button>
        </div>

        {preview && (
          <div className={`${classes.subtlePanel} mt-5 p-4`}>
            <h3 className="font-bold">Confirm audience</h3>
            <p className="mt-2 text-lg font-bold">
              {preview.eligibleCount} eligible recipients
            </p>
            <ul className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}>
              <li>{preview.exclusions.cancelled} cancelled</li>
              <li>{preview.exclusions.missingContact} missing contact</li>
              <li>
                {preview.exclusions.preferenceDisabled} preference disabled
              </li>
              <li>{preview.exclusions.ineligible} ineligible</li>
            </ul>
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
