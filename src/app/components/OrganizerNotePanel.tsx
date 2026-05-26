"use client";

import { useEffect, useState } from "react";

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
};

const emptyAccess: OrganizerNoteAccess = {
  canViewCurrentNote: false,
  canEditCurrentNote: false,
  canViewRevisions: false,
};

export default function OrganizerNotePanel({
  hackerId,
  title = "Organizer note",
}: OrganizerNotePanelProps) {
  const [note, setNote] = useState<OrganizerNote | null>(null);
  const [body, setBody] = useState("");
  const [access, setAccess] = useState<OrganizerNoteAccess>(emptyAccess);
  const [revisions, setRevisions] = useState<OrganizerNoteRevision[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!hackerId) return;

    fetch(`/api/hackers/${hackerId}/organizer-note`)
      .then(async (response) => {
        if (!response.ok) {
          setStatus("Organizer note unavailable");
          return null;
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload) return;
        setNote(payload.note ?? null);
        setBody(payload.note?.body ?? "");
        setAccess(payload.access ?? emptyAccess);
      })
      .catch(() => setStatus("Organizer note unavailable"));
  }, [hackerId]);

  async function saveNote() {
    const response = await fetch(`/api/hackers/${hackerId}/organizer-note`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      setStatus("Unable to save organizer note");
      return;
    }

    const payload = await response.json();
    setNote(payload.note ?? null);
    setAccess(payload.access ?? access);
    setStatus("Organizer note saved");
  }

  async function loadRevisions() {
    const response = await fetch(
      `/api/hackers/${hackerId}/organizer-note/revisions`
    );

    if (!response.ok) {
      setStatus("Revision history unavailable");
      return;
    }

    const payload = await response.json();
    setRevisions(Array.isArray(payload.revisions) ? payload.revisions : []);
    setAccess(payload.access ?? access);
  }

  if (!access.canViewCurrentNote && status) {
    return (
      <section className="border rounded p-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 text-sm">{status}</p>
      </section>
    );
  }

  return (
    <section className="border rounded p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <textarea
        aria-label={title}
        className="block border rounded px-3 py-2 mt-3 min-h-32 w-full"
        disabled={!access.canEditCurrentNote}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="border rounded px-4 py-2"
          disabled={!access.canEditCurrentNote}
          onClick={saveNote}
          type="button"
        >
          Save note
        </button>
        {access.canViewRevisions && (
          <button
            className="border rounded px-4 py-2"
            onClick={loadRevisions}
            type="button"
          >
            View revisions
          </button>
        )}
      </div>
      {note?.updatedBy?.name && (
        <p className="mt-2 text-sm opacity-70">Updated by {note.updatedBy.name}</p>
      )}
      {status && <p className="mt-2 text-sm">{status}</p>}
      {revisions.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold">Revision history</h3>
          {revisions.map((revision) => (
            <pre
              className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs"
              key={revision.id}
            >
              {revision.patchText}
            </pre>
          ))}
        </div>
      )}
    </section>
  );
}
