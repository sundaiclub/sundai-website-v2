"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Chapter = {
  id: string;
  name: string;
  slug: string;
  city: string;
  accessMode: string;
  status: string;
  viewerMembership?: { status: string } | null;
  memberships?: Array<{ status: string }>;
};

function list(payload: unknown): Chapter[] {
  if (Array.isArray(payload)) return payload as Chapter[];
  if (payload && typeof payload === "object") {
    const value = payload as { chapters?: Chapter[]; items?: Chapter[] };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    fetch("/api/chapters")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setChapters(list(payload)))
      .catch(() => setChapters([]));
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold mb-6">Chapters</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/chapters/${chapter.slug}`}
              className="border rounded-lg p-4"
            >
              <div className="font-semibold">{chapter.name}</div>
              <div className="text-sm opacity-70">{chapter.city}</div>
              <div className="text-xs mt-2">{chapter.accessMode}</div>
              <div className="text-xs mt-1">
                {chapter.viewerMembership?.status || chapter.memberships?.[0]?.status || ""}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
