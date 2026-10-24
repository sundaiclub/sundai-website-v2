'use client';

import { useState, type FormEvent } from 'react';
import {
  ManagementAlert,
  useManagementClasses,
  type ManagementTone,
} from '@/app/components/ManagementSurface';
import type { EventWorkspaceStaffMember } from '@/types/event-workspace';

export default function AddCoMcByEmail({
  eventId,
  onAssigned,
}: {
  eventId: string;
  onAssigned: (member: EventWorkspaceStaffMember) => void;
}) {
  const classes = useManagementClasses();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<ManagementTone>('success');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/events/${eventId}/staff`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role: 'CO_MC' }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message ?? 'Unable to add the co-MC.');
      onAssigned({ ...payload.staff, name: payload.staff.hacker.name });
      setEmail('');
      setTone(payload.delivery.sent ? 'success' : 'warning');
      setMessage(
        payload.delivery.sent
          ? 'Co-MC added. Email sent.'
          : payload.delivery.message
      );
    } catch (error) {
      setTone('danger');
      setMessage(
        error instanceof Error ? error.message : 'Unable to add the co-MC.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${classes.subtlePanel} mt-5 space-y-3 p-4`}>
      <h3 className="font-bold">Add a co-MC by email</h3>
      <p className={`text-sm ${classes.mutedText}`}>
        We will send a link to the event. If the person has no account, they
        must create one and verify this email address to get access.
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={submit}
      >
        <label className="block min-w-0 flex-1 text-sm font-semibold">
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
        <button
          className={`${classes.primaryButton} h-11 shrink-0 self-start whitespace-nowrap sm:self-auto`}
          disabled={busy}
          type="submit"
        >
          Add co-MC and send email
        </button>
      </form>
      {message && (
        <ManagementAlert tone={tone}>
          <span role="status">{message}</span>
        </ManagementAlert>
      )}
    </div>
  );
}
