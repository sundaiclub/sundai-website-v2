'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';

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
  if (payload && typeof payload === 'object') {
    const value = payload as { chapters?: Chapter[]; items?: Chapter[] };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function AdminChaptersPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading } = useUserContext();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/chapters')
      .then(response => (response.ok ? response.json() : []))
      .then(payload => setChapters(chapterList(payload)))
      .catch(() => setChapters([]));
  }, [isAdmin]);

  async function createChapter(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/chapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        city,
        country: 'US',
        timezone: 'America/New_York',
        accessMode: 'PUBLIC',
        status: 'ACTIVE',
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setChapters(current => [...current, created]);
      setName('');
      setCity('');
    }
  }

  return (
    <ManagementPage>
      <AdminAuthGate isAdmin={isAdmin} loading={loading}>
        <>
          <ManagementHeader
            eyebrow="Site admin"
            title="Chapters"
            description="Create chapters and jump into chapter-level organizer settings."
          />
          <ManagementSection title="Create chapter">
            <form
              onSubmit={createChapter}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <input
                aria-label="Chapter name"
                className={classes.input}
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Chapter name"
              />
              <input
                aria-label="City"
                className={classes.input}
                value={city}
                onChange={event => setCity(event.target.value)}
                placeholder="City"
              />
              <button
                className={classes.primaryButton}
                disabled={!name.trim() || !city.trim()}
                type="submit"
              >
                Create chapter
              </button>
            </form>
          </ManagementSection>

          <div className="mt-5">
            <ManagementSection title="Existing chapters">
              <div className={`divide-y ${classes.divider}`}>
                {chapters.map(chapter => (
                  <div
                    key={chapter.id}
                    className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  >
                    <Link
                      className="block min-w-0 rounded-md py-1 underline-offset-4 hover:underline"
                      href={`/chapters/${chapter.slug}`}
                    >
                      <div className="font-semibold">{chapter.name}</div>
                      <div className={`text-sm ${classes.mutedText}`}>
                        {chapter.city}
                      </div>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <ManagementBadge
                        tone={
                          chapter.status === 'ACTIVE' ? 'success' : 'warning'
                        }
                      >
                        {chapter.status}
                      </ManagementBadge>
                      <ManagementBadge>{chapter.accessMode}</ManagementBadge>
                    </div>
                    <ManagementLinkButton
                      href={`/organizer/chapters/${chapter.slug}/settings#admins`}
                    >
                      Manage admins
                    </ManagementLinkButton>
                  </div>
                ))}
                {chapters.length === 0 && (
                  <ManagementEmptyState>
                    No chapters have been created.
                  </ManagementEmptyState>
                )}
              </div>
            </ManagementSection>
          </div>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
