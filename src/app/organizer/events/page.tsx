"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";

type EventItem = {
  id: string;
  title: string;
  startTime: string;
  chapter?: { name: string };
};

function list(payload: unknown): EventItem[] {
  return Array.isArray(payload) ? (payload as EventItem[]) : [];
}

export default function OrganizerEventsPage() {
  const { isAdmin } = useUserContext();
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setEvents(list(payload)))
      .catch(() => setEvents([]));
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Organizer events</h1>
          {isAdmin && (
            <Link href="/organizer/events/new" className="border rounded px-4 py-2">
              New event
            </Link>
          )}
        </div>
        <div className="divide-y">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/organizer/events/${event.id}/settings`}
              className="block py-3"
            >
              <div className="font-semibold">{event.title}</div>
              <div className="text-sm opacity-70">
                {event.chapter?.name || "Chapter event"}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
