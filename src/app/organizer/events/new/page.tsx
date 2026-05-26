"use client";

import { useState } from "react";

export default function OrganizerNewEventPage() {
  const [title, setTitle] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [message, setMessage] = useState("");

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        chapterId,
        startTime,
        visibility: "PUBLIC",
        applicationMode: "NONE",
      }),
    });
    setMessage(response.ok ? "Event saved" : "Unable to save event");
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold mb-6">New event</h1>
        <form onSubmit={createEvent} className="grid gap-4">
          <input
            aria-label="Title"
            className="border rounded px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
          />
          <input
            aria-label="Chapter ID"
            className="border rounded px-3 py-2"
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            placeholder="Chapter ID"
          />
          <input
            aria-label="Start time"
            className="border rounded px-3 py-2"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            placeholder="2026-05-25T18:00:00.000Z"
          />
          <button className="border rounded px-4 py-2 font-semibold" type="submit">
            Save draft
          </button>
          {message && <div>{message}</div>}
        </form>
      </div>
    </main>
  );
}
