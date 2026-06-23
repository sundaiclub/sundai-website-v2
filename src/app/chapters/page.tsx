'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '../components/ManagementSurface';
import type { ChapterDirectoryItem } from '@/types/event-management';

function list(payload: unknown): ChapterDirectoryItem[] {
  if (Array.isArray(payload)) return payload as ChapterDirectoryItem[];
  if (payload && typeof payload === 'object') {
    const value = payload as {
      chapters?: ChapterDirectoryItem[];
      items?: ChapterDirectoryItem[];
    };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function ChaptersPage() {
  const classes = useManagementClasses();
  const [chapters, setChapters] = useState<ChapterDirectoryItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';

  useEffect(() => {
    setLoadError('');
    fetch('/api/chapters')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => setChapters(list(payload)))
      .catch(() => setLoadError('Unable to load chapters.'));
  }, []);

  return (
    <ManagementPage>
      <ManagementHeader
        title="Chapters"
        description="Find a Sundai chapter and see the membership state available to you."
      />
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {chapters.map(chapter => (
          <article
            key={chapter.id}
            className={`${classes.panel} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div
              className={`${classes.subtlePanel} relative mb-4 flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-md`}
            >
              {chapter.heroImage?.url ? (
                <Image
                  alt={chapter.heroImage.alt || `${chapter.name} chapter`}
                  className="object-cover"
                  fill
                  src={chapter.heroImage.url}
                  sizes="(min-width: 640px) 50vw, 100vw"
                  unoptimized
                />
              ) : (
                <Image
                  alt="Sundai Club logo"
                  className="object-contain p-8"
                  fill
                  src={placeholderLogo}
                  sizes="(min-width: 640px) 320px, 60vw"
                />
              )}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  className="block truncate text-lg font-bold hover:underline"
                  href={`/chapters/${chapter.slug}`}
                >
                  {chapter.name}
                </Link>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {chapter.city}
                </div>
                <div className={`mt-1 text-xs ${classes.mutedText}`}>
                  {chapter.timezone}
                </div>
              </div>
              <ManagementBadge>{chapter.accessMode}</ManagementBadge>
            </div>
            {chapter.nextEvent && (
              <div className={`mt-4 border-t pt-4 ${classes.divider}`}>
                <div className={`text-xs font-semibold ${classes.mutedText}`}>
                  Next event
                </div>
                <Link
                  className="mt-1 block font-semibold hover:underline"
                  href={`/events/${chapter.slug}/${chapter.nextEvent.slug}`}
                >
                  {chapter.nextEvent.title}
                </Link>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {chapter.nextEvent.publicLocation}
                </div>
              </div>
            )}
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
          </article>
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
