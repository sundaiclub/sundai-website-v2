'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';

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
  const classes = useManagementClasses();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [denied, setDenied] = useState(false);
  const membership = firstMembership(chapter);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(false);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetch(`/api/chapters/${params.chapterSlug}`)
      .then(async response => {
        if (!response.ok) {
          setDenied(true);
          return null;
        }
        return response.json();
      })
      .then(payload => {
        setChapter(payload);
        const nextMembership = firstMembership(payload);
        setNotificationsAllowed(Boolean(nextMembership?.notificationsAllowed));
        setEmailNotificationsEnabled(
          Boolean(nextMembership?.emailNotificationsEnabled)
        );
        setSmsNotificationsEnabled(
          Boolean(nextMembership?.smsNotificationsEnabled)
        );
      })
      .catch(() => setDenied(true));
  }, [params.chapterSlug]);

  async function join() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/join`, {
      method: 'POST',
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
    }
  }

  async function acceptInvite() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/invites/accept`, {
      method: 'POST',
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
    }
  }

  async function updateNotifications() {
    if (!chapter) return;
    const response = await fetch(`/api/chapters/${chapter.id}/notifications`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notificationsAllowed,
        emailNotificationsEnabled,
        smsNotificationsEnabled,
      }),
    });
    if (response.ok) {
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
    }
  }

  if (denied) {
    return (
      <ManagementPage maxWidth="max-w-4xl">
        <ManagementAlert tone="danger">
          You do not have permission to view this chapter.
        </ManagementAlert>
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-4xl">
      <ManagementHeader
        title={chapter?.name || 'Chapter'}
        description={chapter?.description || chapter?.city}
        actions={
          <>
            {chapter?.accessMode && (
              <ManagementBadge>{chapter.accessMode}</ManagementBadge>
            )}
            <ManagementBadge
              tone={
                membership?.status === 'ACTIVE'
                  ? 'success'
                  : membership?.status === 'INVITED'
                    ? 'warning'
                    : 'default'
              }
            >
              {membership?.status === 'ACTIVE'
                ? 'Active member'
                : membership?.status === 'INVITED'
                  ? 'Invited'
                  : 'Not joined'}
            </ManagementBadge>
          </>
        }
      />
      <div className="grid gap-5">
        <ManagementSection title="Upcoming events">
          <div className={`divide-y ${classes.divider}`}>
            {(chapter?.upcomingEvents ?? []).map(event => (
              <div key={event.id} className="py-3">
                <div className="font-semibold">{event.title}</div>
                <div className={`mt-1 text-sm ${classes.mutedText}`}>
                  {event.publicLocation}
                </div>
              </div>
            ))}
            {(chapter?.upcomingEvents ?? []).length === 0 && (
              <ManagementEmptyState>
                No upcoming events are listed.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <div className="flex flex-wrap gap-3">
          {chapter?.accessMode === 'PUBLIC' &&
            membership?.status !== 'ACTIVE' && (
              <button
                className={classes.primaryButton}
                onClick={join}
                type="button"
              >
                Join chapter
              </button>
            )}
          {membership?.status === 'INVITED' && (
            <button
              className={classes.primaryButton}
              onClick={acceptInvite}
              type="button"
            >
              Accept invitation
            </button>
          )}
        </div>

        {membership?.status === 'ACTIVE' && (
          <ManagementSection
            title="Notification preferences"
            description="Choose how this chapter can contact you."
          >
            <div className="grid max-w-md gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  aria-label="Allow notifications"
                  className={classes.checkbox}
                  checked={notificationsAllowed}
                  onChange={event =>
                    setNotificationsAllowed(event.target.checked)
                  }
                  type="checkbox"
                />
                Allow notifications
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  aria-label="Email"
                  className={classes.checkbox}
                  checked={emailNotificationsEnabled}
                  onChange={event =>
                    setEmailNotificationsEnabled(event.target.checked)
                  }
                  type="checkbox"
                />
                Email
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  aria-label="SMS"
                  className={classes.checkbox}
                  checked={smsNotificationsEnabled}
                  onChange={event =>
                    setSmsNotificationsEnabled(event.target.checked)
                  }
                  type="checkbox"
                />
                SMS
              </label>
              <button
                className={classes.primaryButton}
                onClick={updateNotifications}
                type="button"
              >
                Save notification preferences
              </button>
            </div>
          </ManagementSection>
        )}
      </div>
    </ManagementPage>
  );
}
