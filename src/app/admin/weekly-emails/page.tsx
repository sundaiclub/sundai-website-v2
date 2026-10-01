'use client';

import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import MarkdownEditor from '@/app/components/MarkdownEditor';
import { useUserContext } from '@/app/contexts/UserContext';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '@/app/components/ManagementSurface';

type Draft = { id: string; subject: string; body: string };

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.message || 'The request failed. Please try again.'
    );
  return payload;
}

export default function WeeklyEmailsPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading, userInfo } = useUserContext();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [queuedSend, setQueuedSend] = useState<{
    id: string;
    test: boolean;
    batches: string[];
  } | null>(null);

  useEffect(() => {
    if (!queuedSend) return;
    let current = true;
    const timer = setInterval(async () => {
      try {
        const result = await readResponse(
          await fetch(
            `/api/admin/weekly-emails/${queuedSend.id}${queuedSend.test ? `?batches=${queuedSend.batches.join(',')}` : ''}`
          )
        );
        if (!current) return;
        if (result.pending) {
          setNotice(
            `Sending. ${result.sent} emails accepted; ${result.failed} failed.`
          );
        } else {
          setQueuedSend(null);
          if (queuedSend.test) {
            if (result.failed)
              setError(
                'The test email could not be sent. Your draft is saved.'
              );
            else setNotice('Test email sent to your account email address.');
          } else
            setNotice(
              `Send complete. ${result.sent} emails accepted; ${result.failed} failed.`
            );
        }
      } catch {
        /* Keep the saved job; the worker continues without this page. */
      }
    }, 3000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [queuedSend]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/weekly-emails')
      .then(readResponse)
      .then(payload => {
        setDrafts(payload.drafts);
        setReady(true);
      })
      .catch(error => setError(error.message));
  }, [isAdmin]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function selectDraft(id: string) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const draft = drafts.find(item => item.id === id);
    setDraftId(id);
    setSubject(draft?.subject || '');
    setBody(draft?.body || '');
    setDirty(false);
    setError('');
    setNotice('');
  }

  async function act(action: 'save' | 'test' | 'send') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Always save the current editor content before a test or full send.
      const saved: Draft = await readResponse(
        await fetch(
          draftId
            ? `/api/admin/weekly-emails/${draftId}`
            : '/api/admin/weekly-emails',
          {
            method: draftId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, body }),
          }
        )
      );
      setDraftId(saved.id);
      setSubject(saved.subject);
      setDirty(false);
      setDrafts(current => [
        saved,
        ...current.filter(item => item.id !== saved.id),
      ]);
      if (action === 'save') {
        setNotice('Draft saved.');
        return;
      }
      const result = await readResponse(
        await fetch(`/api/admin/weekly-emails/${saved.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      );
      if (action === 'test') {
        setNotice('Test email queued for your account email address.');
      } else {
        setDrafts(current => current.filter(item => item.id !== saved.id));
        setDraftId('');
        setSubject('');
        setBody('');
        setNotice(
          `${result.queued} emails queued. You can close this page while they send.`
        );
      }
      setQueuedSend({
        id: saved.id,
        test: action === 'test',
        batches: result.batchIds,
      });
      if (result.warning) setError(result.warning);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to complete the request.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManagementPage>
      <AdminAuthGate
        isAdmin={isAdmin}
        isAuthenticated={Boolean(userInfo)}
        loading={loading}
      >
        <div className="mb-4">
          <ManagementBackButton />
        </div>
        <ManagementHeader
          eyebrow="Site admin"
          title="Weekly emails"
          description="Write a community update. Each member receives their next chapter events and the top five projects from the past seven days."
        />
        {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
        {notice && <ManagementAlert tone="success">{notice}</ManagementAlert>}
        {!ready && !error && (
          <ManagementAlert>Loading drafts...</ManagementAlert>
        )}
        <ManagementSection>
          <p className={`mb-3 text-sm ${classes.mutedText}`}>
            Emails send in the background. Resume pending work if a queue
            request failed; emails already attempted will not be sent again.
          </p>
          <button
            className={`${classes.secondaryButton} mb-5`}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await readResponse(
                  await fetch('/api/admin/email-queue', { method: 'POST' })
                );
                setError('');
                setNotice(
                  `${result.queuedBatches} pending email batches queued.`
                );
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : 'Unable to resume queued emails.'
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Resume queued emails
          </button>
          <fieldset
            disabled={busy || !ready}
            className="grid min-w-0 gap-5 disabled:opacity-70"
          >
            <label className="grid gap-2">
              <span className="font-semibold">Saved drafts</span>
              <select
                className={classes.input}
                value={draftId}
                disabled={drafts.length === 0}
                onChange={event => selectDraft(event.target.value)}
              >
                <option value="" disabled>
                  {drafts.length === 0
                    ? 'No drafts right now'
                    : 'Select a saved draft'}
                </option>
                {drafts.map(draft => (
                  <option key={draft.id} value={draft.id}>
                    {draft.subject || 'Untitled draft'}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="font-semibold">Subject</span>
              <input
                className={classes.input}
                value={subject}
                maxLength={200}
                onChange={event => {
                  setSubject(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <MarkdownEditor
              label="Weekly email message"
              value={body}
              onChange={value => {
                setBody(value);
                setDirty(true);
              }}
              maxLength={50000}
            />
            <p className={`text-sm ${classes.mutedText}`}>
              Preview shows your Markdown message. Send a test to see the full
              email with your name, chapter events, and this week’s projects.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className={classes.secondaryButton}
                type="button"
                onClick={() => act('save')}
              >
                Save draft
              </button>
              <button
                className={classes.secondaryButton}
                type="button"
                disabled={!subject.trim() || !body.trim()}
                onClick={() => act('test')}
              >
                Send test to myself
              </button>
              <button
                className={classes.primaryButton}
                type="button"
                disabled={!subject.trim() || !body.trim()}
                onClick={() => act('send')}
              >
                Send
              </button>
            </div>
          </fieldset>
          {busy && (
            <p role="status" className="mt-4 text-sm">
              Please wait. Keep this page open until the request completes.
            </p>
          )}
        </ManagementSection>
      </AdminAuthGate>
    </ManagementPage>
  );
}
