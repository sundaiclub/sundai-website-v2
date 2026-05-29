'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '../components/ManagementSurface';

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
  if (payload && typeof payload === 'object') {
    const value = payload as { chapters?: Chapter[]; items?: Chapter[] };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function ChaptersPage() {
  const classes = useManagementClasses();
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    fetch('/api/chapters')
      .then(response => (response.ok ? response.json() : []))
      .then(payload => setChapters(list(payload)))
      .catch(() => setChapters([]));
  }, []);

  return (
    <ManagementPage>
      <ManagementHeader
        title="Chapters"
        description="Find a Sundai chapter and see the membership state available to you."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {chapters.map(chapter => (
          <Link
            key={chapter.id}
            href={`/chapters/${chapter.slug}`}
            className={`${classes.panel} block p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">{chapter.name}</div>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {chapter.city}
                </div>
              </div>
              <ManagementBadge>{chapter.accessMode}</ManagementBadge>
            </div>
            {(chapter.viewerMembership?.status ||
              chapter.memberships?.[0]?.status) && (
              <div className="mt-4">
                <ManagementBadge
                  tone={
                    (chapter.viewerMembership?.status ||
                      chapter.memberships?.[0]?.status) === 'ACTIVE'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {chapter.viewerMembership?.status ||
                    chapter.memberships?.[0]?.status}
                </ManagementBadge>
              </div>
            )}
          </Link>
        ))}
        {chapters.length === 0 && (
          <div className="sm:col-span-2">
            <ManagementEmptyState>
              No chapters are available.
            </ManagementEmptyState>
          </div>
        )}
      </div>
    </ManagementPage>
  );
}
