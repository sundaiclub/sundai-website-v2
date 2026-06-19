'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../components/ManagementSurface';
import type { ManageableChapterListItem } from '@/types/event-management';

function chapterList(payload: unknown): ManageableChapterListItem[] {
  return Array.isArray(payload) ? (payload as ManageableChapterListItem[]) : [];
}

export default function OrganizerPage() {
  const classes = useManagementClasses();
  const [chapters, setChapters] = useState<ManageableChapterListItem[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setAuthStatus(null);
    setLoadError('');

    fetch('/api/chapters?manageable=true')
      .then(response => {
        const nextAuthStatus = authStatusFromResponse(response);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return null;
        }
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => {
        if (isCurrent && payload) setChapters(chapterList(payload));
      })
      .catch(() => {
        if (isCurrent) setLoadError('Unable to load organizer access.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading) {
    return (
      <ManagementPage>
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage>
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage>
      <ManagementHeader
        eyebrow="Organizer"
        title="Organizer console"
        description="Manage chapters, member access, local application templates, moderation flags, and chapter events."
        actions={
          <ManagementLinkButton href="/organizer/events" variant="primary">
            Events
          </ManagementLinkButton>
        }
      />
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      <ManagementSection title="Managed chapters">
        <div className={`divide-y ${classes.divider}`}>
          {chapters.map(chapter => (
            <div
              key={chapter.id}
              className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <Link
                href={`/organizer/chapters/${chapter.slug}/settings`}
                className="block min-w-0 rounded-md py-1 underline-offset-4 hover:underline"
              >
                <div className="truncate font-semibold">{chapter.name}</div>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {[chapter.city, chapter.region].filter(Boolean).join(', ')}
                </div>
              </Link>
              <div className="flex flex-wrap gap-2">
                <ManagementBadge
                  tone={chapter.status === 'ACTIVE' ? 'success' : 'warning'}
                >
                  {chapter.status}
                </ManagementBadge>
                <ManagementBadge>{chapter.accessMode}</ManagementBadge>
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
              No managed chapters are available.
            </ManagementEmptyState>
          )}
        </div>
      </ManagementSection>
    </ManagementPage>
  );
}
