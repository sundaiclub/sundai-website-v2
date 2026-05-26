"use client";

import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";

type Chapter = {
  id: string;
  name: string;
  slug: string;
  city: string;
  status: string;
  accessMode: string;
};

function chapterList(payload: unknown): Chapter[] {
  if (Array.isArray(payload)) return payload as Chapter[];
  if (payload && typeof payload === "object") {
    const value = payload as { chapters?: Chapter[]; items?: Chapter[] };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function AdminChaptersPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin } = useUserContext();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/chapters")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setChapters(chapterList(payload)))
      .catch(() => setChapters([]));
  }, [isAdmin]);

  async function createChapter(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/chapters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        city,
        country: "US",
        timezone: "America/New_York",
        accessMode: "PUBLIC",
        status: "ACTIVE",
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setChapters((current) => [...current, created]);
      setName("");
      setCity("");
    }
  }

  return (
    <main
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-6xl mx-auto px-4 py-20">
        {isAdmin ? (
          <>
            <h1 className="text-3xl font-bold mb-6">Chapters</h1>
            <form onSubmit={createChapter} className="grid gap-3 md:grid-cols-4 mb-8">
              <input
                aria-label="Chapter name"
                className="border rounded px-3 py-2 text-gray-900"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Chapter name"
              />
              <input
                aria-label="City"
                className="border rounded px-3 py-2 text-gray-900"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
              />
              <button className="border rounded px-4 py-2 font-semibold" type="submit">
                Create chapter
              </button>
            </form>
            <div className="divide-y">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{chapter.name}</div>
                    <div className="text-sm opacity-70">{chapter.city}</div>
                  </div>
                  <div className="text-sm">
                    {chapter.status} / {chapter.accessMode}
                  </div>
                  <div className="text-sm">Manage admins</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-red-500">
            You do not have permission to view this page.
          </div>
        )}
      </div>
    </main>
  );
}
