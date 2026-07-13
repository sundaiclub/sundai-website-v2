'use client';

import { useEffect, useState } from 'react';
import {
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

type OrganizerNote = {
  id: string;
  body: string;
  updatedAt?: string | Date;
  updatedBy?: { name?: string | null } | null;
};

type OrganizerNoteAccess = {
  canViewCurrentNote: boolean;
  canEditCurrentNote: boolean;
  canViewRevisions: boolean;
};

type OrganizerNoteRevision = {
  id: string;
  patchText: string;
  createdAt?: string | Date;
  editedBy?: { name?: string | null } | null;
};

type OrganizerNotePanelProps = {
  hackerId: string;
  title?: string;
} & (
  | { eventId: string; chapterId?: never }
  | { eventId?: never; chapterId: string }
);

const emptyAccess: OrganizerNoteAccess = {
  canViewCurrentNote: false,
  canEditCurrentNote: false,
  canViewRevisions: false,
};

export default function OrganizerNotePanel({
  hackerId,
  title = 'Organizer note',
  eventId,
  chapterId,
}: OrganizerNotePanelProps) {
  const classes = useManagementClasses();
  const [note, setNote] = useState<OrganizerNote | null>(null);
  const [body, setBody] = useState('');
  const [access, setAccess] = useState<OrganizerNoteAccess>(emptyAccess);
  const [revisions, setRevisions] = useState<OrganizerNoteRevision[]>([]);
  const [status, setStatus] = useState('');
  const scope = eventId
    ? `eventId=${encodeURIComponent(eventId)}`
    : `chapterId=${encodeURIComponent(chapterId!)}`;

  useEffect(() => {
    if (!hackerId) return;

    fetch(`/api/hackers/${hackerId}/organizer-note?${scope}`)
      .then(async response => {
        if (!response.ok) {
          setStatus('Organizer note unavailable');
          return null;
        }
        return response.json();
      })
      .then(payload => {
        if (!payload) return;
        setNote(payload.note ?? null);
        setBody(payload.note?.body ?? '');
        setAccess(payload.access ?? emptyAccess);
      })
      .catch(() => setStatus('Organizer note unavailable'));
  }, [hackerId, scope]);

  async function saveNote() {
    const response = await fetch(
      `/api/hackers/${hackerId}/organizer-note?${scope}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      }
    );

    if (!response.ok) {
      setStatus('Unable to save organizer note');
      return;
    }

    const payload = await response.json();
    setNote(payload.note ?? null);
    setAccess(payload.access ?? access);
    setStatus('Organizer note saved');
  }

  async function loadRevisions() {
    const response = await fetch(
      `/api/hackers/${hackerId}/organizer-note/revisions?${scope}`
    );

    if (!response.ok) {
      setStatus('Revision history unavailable');
      return;
    }

    const payload = await response.json();
    setRevisions(Array.isArray(payload.revisions) ? payload.revisions : []);
    setAccess(payload.access ?? access);
  }

  if (!access.canViewCurrentNote && status) {
    return (
      <ManagementSection title={title}>
        <ManagementEmptyState>{status}</ManagementEmptyState>
      </ManagementSection>
    );
  }

  return (
    <ManagementSection title={title}>
      <textarea
        aria-label={title}
        className={`${classes.textarea} mt-3 block w-full`}
        disabled={!access.canEditCurrentNote}
        value={body}
        onChange={event => setBody(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={classes.primaryButton}
          disabled={!access.canEditCurrentNote}
          onClick={saveNote}
          type="button"
        >
          Save note
        </button>
        {access.canViewRevisions && (
          <button
            className={classes.secondaryButton}
            onClick={loadRevisions}
            type="button"
          >
            View revisions
          </button>
        )}
      </div>
      {note?.updatedBy?.name && (
        <p className={`mt-2 text-sm ${classes.mutedText}`}>
          Updated by {note.updatedBy.name}
        </p>
      )}
      {status && (
        <p className={`mt-2 text-sm ${classes.mutedText}`}>{status}</p>
      )}
      {revisions.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold">Revision history</h3>
          {revisions.map(revision => (
            <pre
              className={`${classes.subtlePanel} mt-2 whitespace-pre-wrap p-3 text-xs`}
              key={revision.id}
            >
              {revision.patchText}
            </pre>
          ))}
        </div>
      )}
    </ManagementSection>
  );
}
