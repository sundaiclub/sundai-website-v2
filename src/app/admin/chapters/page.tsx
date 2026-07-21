'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';
import type { SiteAdminChapterListItem } from '@/types/event-management';

function chapterList(payload: unknown): SiteAdminChapterListItem[] {
  if (Array.isArray(payload)) return payload as SiteAdminChapterListItem[];
  if (payload && typeof payload === 'object') {
    const value = payload as {
      chapters?: SiteAdminChapterListItem[];
      items?: SiteAdminChapterListItem[];
    };
    return value.chapters ?? value.items ?? [];
  }
  return [];
}

export default function AdminChaptersPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading, userInfo } = useUserContext();
  const [chapters, setChapters] = useState<SiteAdminChapterListItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('US');
  const [timezone, setTimezone] = useState('America/New_York');
  const [accessMode, setAccessMode] = useState('PUBLIC');
  const [status, setStatus] = useState('ACTIVE');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setLoadError('');
    fetch('/api/chapters')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => setChapters(chapterList(payload)))
      .catch(() => setLoadError('Unable to load chapters.'));
  }, [isAdmin]);

  async function createChapter(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/chapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        city,
        region,
        country,
        timezone,
        description,
        accessMode,
        status,
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setChapters(current => [...current, created]);
      setName('');
      setSlug('');
      setCity('');
      setRegion('');
      setCountry('US');
      setTimezone('America/New_York');
      setAccessMode('PUBLIC');
      setStatus('ACTIVE');
      setDescription('');
    }
  }

  return (
    <ManagementPage>
      <AdminAuthGate
        isAdmin={isAdmin}
        isAuthenticated={Boolean(userInfo)}
        loading={loading}
      >
        <>
          <div className="mb-4">
            <ManagementBackButton />
          </div>
          <ManagementHeader
            eyebrow="Site admin"
            title="Chapters"
            description="Create chapters and jump into chapter-level organizer settings."
          />
          {loadError && (
            <div className="mb-5">
              <ManagementAlert tone="danger">{loadError}</ManagementAlert>
            </div>
          )}
          <ManagementSection title="Create chapter">
            <form
              onSubmit={createChapter}
              className="grid gap-3"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  aria-label="Chapter name"
                  className={classes.input}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Chapter name"
                />
                <input
                  aria-label="Slug"
                  className={classes.input}
                  value={slug}
                  onChange={event => setSlug(event.target.value)}
                  placeholder="Slug, optional"
                />
                <input
                  aria-label="City"
                  className={classes.input}
                  value={city}
                  onChange={event => setCity(event.target.value)}
                  placeholder="City"
                />
                <input
                  aria-label="Region"
                  className={classes.input}
                  value={region}
                  onChange={event => setRegion(event.target.value)}
                  placeholder="Region or state"
                />
                <input
                  aria-label="Country"
                  className={classes.input}
                  value={country}
                  onChange={event => setCountry(event.target.value)}
                  placeholder="Country"
                />
                <input
                  aria-label="Timezone"
                  className={classes.input}
                  value={timezone}
                  onChange={event => setTimezone(event.target.value)}
                  placeholder="Timezone"
                />
                <select
                  aria-label="Access mode"
                  className={classes.input}
                  value={accessMode}
                  onChange={event => setAccessMode(event.target.value)}
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
                <select
                  aria-label="Status"
                  className={classes.input}
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <textarea
                aria-label="Description"
                className={`${classes.textarea} min-h-24`}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Public chapter description"
              />
              <div>
                <button
                  className={classes.primaryButton}
                  disabled={
                    !name.trim() ||
                    !city.trim() ||
                    !country.trim() ||
                    !timezone.trim()
                  }
                  type="submit"
                >
                  Create chapter
                </button>
              </div>
            </form>
          </ManagementSection>

          <div className="mt-5">
            <ManagementSection title="Existing chapters">
              <div className={`divide-y ${classes.divider}`}>
                {chapters.map(chapter => (
                  <div
                    key={chapter.id}
                    className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
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
                    <div className="flex flex-wrap gap-2">
                      <ManagementLinkButton href={`/chapters/${chapter.slug}`}>
                        Public page
                      </ManagementLinkButton>
                      <ManagementLinkButton
                        href={`/organizer/chapters/${chapter.slug}/settings`}
                      >
                        Settings
                      </ManagementLinkButton>
                    </div>
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
