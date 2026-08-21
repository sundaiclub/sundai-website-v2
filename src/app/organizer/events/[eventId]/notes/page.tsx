'use client';

import { useEffect, useState, use } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';

type NoteRow = {
  hacker?: { id: string; name: string; username?: string | null };
  hackerId?: string;
  name?: string;
  registrationStatus?: string;
  projectTitles?: string[];
  note?: { body: string; updatedAt?: string } | null;
};

type NoteDetail = NoteRow & {
  note: { body: string; updatedAt?: string } | null;
};

type NoteRevision = {
  id: string;
  body?: string;
  patchText?: string;
  editedAt?: string;
  createdAt?: string;
  editedBy?: { id: string; name: string };
};

function rowId(row: NoteRow) {
  return row.hacker?.id ?? row.hackerId ?? '';
}

function rowName(row: NoteRow) {
  return row.hacker?.name ?? row.name ?? 'Unknown hacker';
}

export default function OrganizerEventNotesPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const params = use(props.params);
  const classes = useManagementClasses();
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [canViewRevisions, setCanViewRevisions] = useState(false);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const [revisions, setRevisions] = useState<NoteRevision[] | null>(null);

  async function loadRows(query = '') {
    setState('loading');
    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : '';
      const response = await fetch(
        `/api/events/${params.eventId}/notes${suffix}`
      );
      if (!response.ok) throw new Error('Unable to load notes');
      const payload = await response.json();
      setRows(
        Array.isArray(payload) ? payload : (payload.items ?? payload.rows ?? [])
      );
      setCanViewRevisions(Boolean(payload.capabilities?.canViewRevisions));
      setState('ready');
    } catch {
      setRows([]);
      setSelected(null);
      setState('error');
    }
  }

  useEffect(() => {
    void loadRows();
    // The event id is the complete server-side scope for this collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.eventId]);

  async function selectRow(row: NoteRow) {
    const id = rowId(row);
    setNotice('');
    setRevisions(null);
    const response = await fetch(`/api/events/${params.eventId}/notes/${id}`);
    if (!response.ok) {
      setNotice('The organizer note is unavailable.');
      return;
    }
    const detail = (await response.json()) as NoteDetail;
    setSelected(detail);
    setBody(detail.note?.body ?? '');
  }

  async function saveNote() {
    if (!selected) return;
    const response = await fetch(
      `/api/events/${params.eventId}/notes/${rowId(selected)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      }
    );
    if (!response.ok) {
      setNotice('Unable to save the note.');
      return;
    }
    const updated = (await response.json()) as NoteDetail;
    setSelected(updated);
    setBody(updated.note?.body ?? body);
    setNotice('Note saved.');
  }

  async function loadHistory() {
    if (!selected || !canViewRevisions) return;
    const response = await fetch(
      `/api/events/${params.eventId}/notes/${rowId(selected)}/revisions`
    );
    if (!response.ok) {
      setNotice('Revision history is unavailable.');
      return;
    }
    const payload = await response.json();
    setRevisions(Array.isArray(payload) ? payload : (payload.items ?? []));
  }

  return (
    <div className="space-y-5">
      <ManagementAlert>
        <div>
          <p className="font-bold">
            Organizer-only internal notes are not public.
          </p>
          <p className="mt-1">
            Do not record sensitive protected-class data without approved
            operational or legal need.
          </p>
        </div>
      </ManagementAlert>

      <ManagementSection
        title="Organizer notes"
        description="Search hackers relevant to this event and maintain their shared organizer notepad."
      >
        <form
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={event => {
            event.preventDefault();
            void loadRows(search.trim());
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Search event hackers</span>
            <input
              aria-label="Search event hackers"
              className={classes.input}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name"
              type="search"
              value={search}
            />
          </label>
          <button className={classes.secondaryButton} type="submit">
            Search
          </button>
        </form>

        {state === 'loading' && (
          <ManagementAlert>
            <span role="status">Loading organizer notes…</span>
          </ManagementAlert>
        )}
        {state === 'error' && (
          <ManagementAlert tone="danger">
            <span role="alert">Organizer notes are unavailable.</span>
          </ManagementAlert>
        )}
        {state === 'ready' && rows.length === 0 && (
          <ManagementEmptyState>
            No relevant hackers or notes were found.
          </ManagementEmptyState>
        )}
        {state === 'ready' && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map(row => (
              <li key={rowId(row)}>
                <button
                  className={`${classes.subtlePanel} w-full p-4 text-left`}
                  onClick={() => selectRow(row)}
                  type="button"
                >
                  <span className="font-bold">{rowName(row)}</span>
                  {row.registrationStatus && (
                    <ManagementBadge>{row.registrationStatus}</ManagementBadge>
                  )}
                  {row.note?.body && (
                    <span className={`mt-1 block text-sm ${classes.mutedText}`}>
                      {row.note.body}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ManagementSection>

      {notice && (
        <ManagementAlert tone={notice === 'Note saved.' ? 'success' : 'danger'}>
          <span role="status">{notice}</span>
        </ManagementAlert>
      )}

      {selected && (
        <ManagementSection
          title={`${rowName(selected)} organizer note`}
          actions={
            canViewRevisions ? (
              <button
                className={classes.secondaryButton}
                onClick={loadHistory}
                type="button"
              >
                View revision history
              </button>
            ) : undefined
          }
        >
          <label>
            <span className="mb-1 block text-sm font-bold">Organizer note</span>
            <textarea
              className={classes.textarea}
              onChange={event => setBody(event.target.value)}
              rows={8}
              value={body}
            />
          </label>
          <button
            className={`${classes.primaryButton} mt-3`}
            onClick={saveNote}
            type="button"
          >
            Save note
          </button>
        </ManagementSection>
      )}

      {revisions && (
        <ManagementSection title="Revision history">
          {revisions.length === 0 ? (
            <ManagementEmptyState>No prior revisions.</ManagementEmptyState>
          ) : (
            <ul className="space-y-3">
              {revisions.map(revision => (
                <li className={`${classes.subtlePanel} p-4`} key={revision.id}>
                  {revision.editedBy?.name && (
                    <p className="font-bold">{revision.editedBy.name}</p>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap text-sm">
                    {revision.body ?? revision.patchText}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </ManagementSection>
      )}
    </div>
  );
}
