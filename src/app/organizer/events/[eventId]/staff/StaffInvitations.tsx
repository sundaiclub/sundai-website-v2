'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useManagementClasses } from '@/app/components/ManagementSurface';

type Invitation = { id: string; email: string; expiresAt: string };

export default function StaffInvitations({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const endpoint = `/api/events/${eventId}/staff/invitations`;

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then(async response => {
        if (!response.ok) throw new Error();
        const rows = await response.json();
        if (active) setInvitations(rows);
      })
      .catch(() => {
        if (active) setMessage('Unable to load co-MC invites.');
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  async function invite(targetEmail: string) {
    setBusy(true);
    setMessage('');
    setLink('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message ?? 'Unable to send the invite.');
      setInvitations(current => [
        payload.invitation,
        ...current.filter(row => row.id !== payload.invitation.id),
      ]);
      setEmail('');
      setMessage(
        payload.delivery.sent ? 'Co-MC invite sent.' : payload.delivery.message
      );
      setLink(payload.delivery.link);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to send the invite.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setInvitations(current => current.filter(row => row.id !== id));
      setLink('');
      setMessage('Co-MC invite cancelled.');
    } catch {
      setMessage('Unable to cancel the invite.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void invite(email);
  }

  return (
    <div className="mt-5 space-y-3">
      <h3 className="font-bold">Invite a co-MC by email</h3>
      <p className={`text-sm ${classes.mutedText}`}>
        An account is not required to receive an invite. The recipient must
        verify this email address to get co-MC access. Invites expire after 7
        days.
      </p>
      <form className="flex flex-wrap gap-2" onSubmit={submit}>
        <label className="flex-1">
          Email address
          <input
            aria-label="Co-MC email address"
            type="email"
            required
            maxLength={254}
            className={`${classes.input} mt-1 block w-full`}
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>
        <button className={classes.primaryButton} disabled={busy} type="submit">
          Send co-MC invite
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {link && (
        <p className="break-all text-sm">
          Invite link:{' '}
          <a className="underline" href={link}>
            {link}
          </a>
        </p>
      )}
      {invitations.map(invitation => (
        <div
          className={`${classes.subtlePanel} flex flex-wrap items-center justify-between gap-2 p-3`}
          key={invitation.id}
        >
          <div>
            <p>{invitation.email}</p>
            <p className={`text-sm ${classes.mutedText}`}>
              {new Date(invitation.expiresAt).getTime() <= Date.now()
                ? 'Expired'
                : 'Pending account verification'}{' '}
              · Expires {new Date(invitation.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={classes.secondaryButton}
              disabled={busy}
              onClick={() => invite(invitation.email)}
            >
              Resend invite
            </button>
            <button
              type="button"
              className={classes.secondaryButton}
              disabled={busy}
              onClick={() => cancel(invitation.id)}
            >
              Cancel invite
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
