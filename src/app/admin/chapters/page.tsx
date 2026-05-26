"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminAuthGate from "../AdminAuthGate";
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
  const { isAdmin, loading } = useUserContext();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const inputClass = `min-h-11 rounded-md border px-3 py-2 text-sm outline-none transition ${
    isDarkMode
      ? "border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500 focus:border-gray-400"
      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-gray-900"
  }`;
  const secondaryButtonClass = `inline-flex min-h-10 items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition ${
    isDarkMode
      ? "border-gray-700 text-gray-100 hover:bg-gray-800"
      : "border-gray-300 text-gray-900 hover:bg-gray-50"
  }`;
  const primaryButtonClass = `min-h-11 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
    isDarkMode
      ? "bg-gray-100 text-gray-900 hover:bg-gray-300"
      : "bg-gray-900 text-white hover:bg-gray-700"
  }`;

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
        <AdminAuthGate isAdmin={isAdmin} loading={loading}>
          <>
            <h1 className="text-3xl font-bold mb-6">Chapters</h1>
            <form
              onSubmit={createChapter}
              className="mb-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <input
                aria-label="Chapter name"
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Chapter name"
              />
              <input
                aria-label="City"
                className={inputClass}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
              />
              <button
                className={primaryButtonClass}
                disabled={!name.trim() || !city.trim()}
                type="submit"
              >
                Create chapter
              </button>
            </form>
            <div className="divide-y">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                >
                  <Link
                    className="block min-w-0 rounded-md py-1 underline-offset-4 hover:underline"
                    href={`/chapters/${chapter.slug}`}
                  >
                    <div className="font-semibold">{chapter.name}</div>
                    <div className="text-sm opacity-70">{chapter.city}</div>
                  </Link>
                  <div className="text-sm">
                    {chapter.status} / {chapter.accessMode}
                  </div>
                  <Link
                    className={secondaryButtonClass}
                    href={`/organizer/chapters/${chapter.slug}/settings#admins`}
                  >
                    Manage admins
                  </Link>
                </div>
              ))}
            </div>
          </>
        </AdminAuthGate>
      </div>
    </main>
  );
}
