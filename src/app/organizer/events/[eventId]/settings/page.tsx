"use client";

import { useEffect, useState } from "react";
import OrganizerNotePanel from "../../../../components/OrganizerNotePanel";

type EventSettings = {
  id: string;
  title: string;
  visibility?: string;
  applicationMode?: string;
  staff?: Array<{
    id: string;
    role: string;
    hacker?: { id?: string; name?: string | null } | null;
  }>;
};

export default function OrganizerEventSettingsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/events/${params.eventId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        setEvent(payload);
        setTitle(payload?.title ?? "");
      })
      .catch(() => setEvent(null));
  }, [params.eventId]);

  async function saveSettings() {
    const response = await fetch(`/api/events/${params.eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setMessage(response.ok ? "Event settings saved" : "Unable to save event settings");
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-5xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold mb-6">Event settings</h1>
        <section className="grid gap-6">
          <label>
            Title
            <input
              className="block border rounded px-3 py-2 mt-2 w-full"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div>
            <h2 className="text-xl font-bold">Staff</h2>
            {(event?.staff ?? []).map((staff) => (
              <div key={staff.id} className="py-1">
                {staff.hacker?.name || staff.id} / {staff.role}
              </div>
            ))}
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Assign MC
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">Application questions</h2>
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Preview merged application
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">Organizer notes</h2>
            {(event?.staff ?? [])
              .filter((staff) => staff.hacker?.id)
              .map((staff) => (
                <OrganizerNotePanel
                  hackerId={staff.hacker!.id!}
                  key={staff.id}
                  title={`Organizer note for ${staff.hacker?.name || "staff member"}`}
                />
              ))}
          </div>
          <button className="border rounded px-4 py-2 font-semibold" onClick={saveSettings} type="button">
            Save settings
          </button>
          {message && <div>{message}</div>}
        </section>
      </div>
    </main>
  );
}
