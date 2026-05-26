"use client";

import { useEffect, useState } from "react";

type Membership = {
  status: string;
  notificationsAllowed?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
};

type Chapter = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  description?: string | null;
  accessMode: string;
  viewerMembership?: Membership | null;
  memberships?: Membership[];
  upcomingEvents?: Array<{
    id: string;
    title: string;
    publicLocation?: string | null;
  }>;
};

function firstMembership(chapter: Chapter | null): Membership | null {
  return chapter?.viewerMembership ?? chapter?.memberships?.[0] ?? null;
}

export default function ChapterLandingPage({
  params,
}: {
  params: { chapterSlug: string };
}) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [denied, setDenied] = useState(false);
  const membership = firstMembership(chapter);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetch(`/api/chapters/${params.chapterSlug}`)
      .then(async (response) => {
        if (!response.ok) {
          setDenied(true);
          return null;
        }
        return response.json();
      })
      .then((payload) => {
        setChapter(payload);
        const nextMembership = firstMembership(payload);
        setNotificationsAllowed(Boolean(nextMembership?.notificationsAllowed));
        setEmailNotificationsEnabled(Boolean(nextMembership?.emailNotificationsEnabled));
        setSmsNotificationsEnabled(Boolean(nextMembership?.smsNotificationsEnabled));
      })
      .catch(() => setDenied(true));
  }, [params.chapterSlug]);

  async function join() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/join`, {
      method: "POST",
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({ ...chapter, viewerMembership: membership, memberships: [membership] });
    }
  }

  async function acceptInvite() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/invites/accept`, {
      method: "POST",
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({ ...chapter, viewerMembership: membership, memberships: [membership] });
    }
  }

  async function updateNotifications() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/notifications`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationsAllowed,
        emailNotificationsEnabled,
        smsNotificationsEnabled,
      }),
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({ ...chapter, viewerMembership: membership, memberships: [membership] });
    }
  }

  if (denied) {
    return (
      <main className="min-h-screen bg-white text-gray-900 font-space-mono">
        <div className="max-w-4xl mx-auto px-4 py-20 text-red-500">
          You do not have permission to view this chapter.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold mb-3">{chapter?.name || "Chapter"}</h1>
        <p className="mb-6">{chapter?.description || chapter?.city}</p>
        <div className="mb-6">
          Membership:{" "}
          {membership?.status === "ACTIVE"
            ? "Active member"
            : membership?.status === "INVITED"
              ? "Invited"
              : "Not joined"}
        </div>
        <section className="mb-6">
          <h2 className="text-xl font-bold mb-2">Upcoming events</h2>
          {(chapter?.upcomingEvents ?? []).map((event) => (
            <div key={event.id} className="py-2">
              <div className="font-semibold">{event.title}</div>
              <div className="text-sm opacity-70">{event.publicLocation}</div>
            </div>
          ))}
        </section>
        {chapter?.accessMode === "PUBLIC" && membership?.status !== "ACTIVE" && (
          <button className="border rounded px-4 py-2 mr-3" onClick={join} type="button">
            Join chapter
          </button>
        )}
        {membership?.status === "INVITED" && (
          <button
            className="border rounded px-4 py-2 mr-3"
            onClick={acceptInvite}
            type="button"
          >
            Accept invitation
          </button>
        )}
        {membership?.status === "ACTIVE" && (
          <section className="grid gap-3 max-w-md">
            <label>
              <input
                aria-label="Allow notifications"
                checked={notificationsAllowed}
                onChange={(event) => setNotificationsAllowed(event.target.checked)}
                type="checkbox"
              />{" "}
              Allow notifications
            </label>
            <label>
              <input
                aria-label="Email"
                checked={emailNotificationsEnabled}
                onChange={(event) => setEmailNotificationsEnabled(event.target.checked)}
                type="checkbox"
              />{" "}
              Email
            </label>
            <label>
              <input
                aria-label="SMS"
                checked={smsNotificationsEnabled}
                onChange={(event) => setSmsNotificationsEnabled(event.target.checked)}
                type="checkbox"
              />{" "}
              SMS
            </label>
            <button
              className="border rounded px-4 py-2"
              onClick={updateNotifications}
              type="button"
            >
              Save notification preferences
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
