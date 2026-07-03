'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';
import type {
  ChapterLanding,
  ChapterMembershipSummary,
} from '@/types/event-management';

function firstMembership(
  chapter: ChapterLanding | null
): ChapterMembershipSummary | null {
  return chapter?.viewerMembership ?? chapter?.memberships?.[0] ?? null;
}

export default function ChapterLandingPage({
  params,
}: {
  params: { chapterSlug: string };
}) {
  const classes = useManagementClasses();
  const { isAdmin, userInfo } = useUserContext();
  const [chapter, setChapter] = useState<ChapterLanding | null>(null);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);
  const membership = firstMembership(chapter);
  const canManageChapter =
    Boolean(chapter) &&
    (isAdmin ||
      (membership?.role === 'ADMIN' && membership.status === 'ACTIVE'));
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(false);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);

  useEffect(() => {
    setDenied(false);
    setLoadError('');
    fetch(`/api/chapters/${params.chapterSlug}`)
      .then(async response => {
        if (response.status === 403 || response.status === 404) {
          setDenied(true);
          return null;
        }
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then(payload => {
        if (!payload) return;
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
      .catch(() => setLoadError('Unable to load chapter.'));
  }, [params.chapterSlug]);

  async function join() {
    if (!chapter) return;
    if (!userInfo) {
      setActionMessage('');
      setActionError('Please sign in to join this chapter.');
      return;
    }

    setIsActing(true);
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/join`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Please sign in to join this chapter.'
            : 'Unable to join this chapter.'
        );
      }
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
      setActionMessage('Chapter membership is active.');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to join this chapter.'
      );
    } finally {
      setIsActing(false);
    }
  }

  async function acceptInvite() {
    if (!chapter) return;
    setIsActing(true);
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/invites/accept`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Unable to accept this invitation.');
      }
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
      setActionMessage('Chapter membership is active.');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to accept this invitation.'
      );
    } finally {
      setIsActing(false);
    }
  }

  async function leaveChapter() {
    if (!chapter) return;
    setIsActing(true);
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/leave`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to leave this chapter.');
      }
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
      setActionMessage('You left this chapter.');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to leave this chapter.'
      );
    } finally {
      setIsActing(false);
    }
  }

  async function updateNotifications() {
    if (!chapter) return;
    setIsActing(true);
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/notifications`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationsAllowed,
          emailNotificationsEnabled,
          smsNotificationsEnabled,
        }),
      });
      if (!response.ok) {
        throw new Error('Unable to save notification preferences.');
      }
      const membership = await response.json();
      setChapter({
        ...chapter,
        viewerMembership: membership,
        memberships: [membership],
      });
      setActionMessage('Notification preferences saved.');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to save notification preferences.'
      );
    } finally {
      setIsActing(false);
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

  const eventChapterSlug = chapter?.slug ?? params.chapterSlug;
  const pendingEvents = chapter?.pendingEvents ?? [];

  return (
    <ManagementPage maxWidth="max-w-4xl">
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      {chapter?.heroImage?.url && (
        <div className="relative mb-6 aspect-[16/7] overflow-hidden rounded-lg">
          <Image
            alt={chapter.heroImage.alt || `${chapter.name} chapter`}
            className="object-cover"
            fill
            src={chapter.heroImage.url}
            sizes="(min-width: 1024px) 896px, 100vw"
            unoptimized
          />
        </div>
      )}
      <ManagementHeader
        title={chapter?.name || 'Chapter'}
        description={chapter?.description || chapter?.city}
        actions={
          <>
            {canManageChapter && chapter && (
              <>
                <ManagementLinkButton
                  href={`/organizer/chapters/${chapter.slug}/settings`}
                  variant="primary"
                >
                  Manage
                </ManagementLinkButton>
                <ManagementLinkButton
                  href={`/organizer/events/new?chapterId=${encodeURIComponent(chapter.id)}`}
                >
                  New event
                </ManagementLinkButton>
              </>
            )}
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
        {canManageChapter && (
          <ManagementSection
            title="Pending events"
            description="Draft, paused, private, and unlisted events for this chapter."
          >
            <div className={`divide-y ${classes.divider}`}>
              {pendingEvents.map(event => (
                <div
                  key={event.id}
                  className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      className="font-semibold hover:underline"
                      href={`/organizer/events/${event.id}/settings`}
                    >
                      {event.title}
                    </Link>
                    <div className={`mt-1 text-sm ${classes.mutedText}`}>
                      {[
                        event.publicLocation,
                        event.startTime
                          ? new Date(event.startTime).toLocaleDateString()
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {event.status && (
                      <ManagementBadge>{event.status}</ManagementBadge>
                    )}
                    {event.visibility && (
                      <ManagementBadge>{event.visibility}</ManagementBadge>
                    )}
                  </div>
                </div>
              ))}
              {pendingEvents.length === 0 && (
                <ManagementEmptyState>
                  No pending events are listed.
                </ManagementEmptyState>
              )}
            </div>
          </ManagementSection>
        )}

        <ManagementSection title="Upcoming events">
          <div className={`divide-y ${classes.divider}`}>
            {(chapter?.upcomingEvents ?? []).map(event => (
              <div key={event.id} className="py-3">
                <Link
                  className="font-semibold hover:underline"
                  href={`/events/${eventChapterSlug}/${event.slug}`}
                >
                  {event.title}
                </Link>
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

        {chapter?.mailingListName && (
          <ManagementSection
            title="Mailing list"
            description={`${chapter.mailingListName} shares chapter updates and event announcements.`}
          >
            <button className={classes.secondaryButton} type="button">
              Join mailing list
            </button>
          </ManagementSection>
        )}

        {(actionMessage || actionError) && (
          <ManagementAlert tone={actionError ? 'danger' : 'success'}>
            {actionError || actionMessage}
          </ManagementAlert>
        )}

        <div className="flex flex-wrap gap-3">
          {chapter?.accessMode === 'PUBLIC' &&
            membership?.status !== 'ACTIVE' && (
              <button
                className={classes.primaryButton}
                disabled={isActing}
                onClick={join}
                type="button"
              >
                Join chapter
              </button>
            )}
          {membership?.status === 'INVITED' && (
            <button
              className={classes.primaryButton}
              disabled={isActing}
              onClick={acceptInvite}
              type="button"
            >
              Accept invitation
            </button>
          )}
          {membership?.status === 'ACTIVE' && membership.role !== 'ADMIN' && (
            <button
              className={classes.secondaryButton}
              disabled={isActing}
              onClick={leaveChapter}
              type="button"
            >
              Leave chapter
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
                disabled={isActing}
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
