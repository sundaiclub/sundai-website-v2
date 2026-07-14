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
  return chapter?.viewerMembership ?? null;
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
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const membership = firstMembership(chapter);
  const canManageChapter =
    Boolean(chapter) &&
    (isAdmin ||
      (Boolean(userInfo) &&
        membership?.role === 'ADMIN' &&
        membership.status === 'ACTIVE'));
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
      setIsPreferencesOpen(false);
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

  function setAllNotifications(enabled: boolean) {
    setNotificationsAllowed(enabled);
    setEmailNotificationsEnabled(enabled);
    setSmsNotificationsEnabled(enabled);
  }

  function openPreferences() {
    setNotificationsAllowed(Boolean(membership?.notificationsAllowed));
    setEmailNotificationsEnabled(
      Boolean(membership?.emailNotificationsEnabled)
    );
    setSmsNotificationsEnabled(Boolean(membership?.smsNotificationsEnabled));
    setActionMessage('');
    setActionError('');
    setIsPreferencesOpen(true);
  }

  function closePreferences() {
    if (isActing) return;
    setIsPreferencesOpen(false);
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
                <Link
                  key={event.id}
                  className="group grid gap-3 rounded-md px-3 py-3 outline-none transition hover:bg-gray-500/5 focus-visible:ring-2 focus-visible:ring-gray-500 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={`/organizer/events/${event.id}/settings`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold group-hover:underline">
                      {event.title}
                    </span>
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
                </Link>
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
              <div
                key={event.id}
                className="grid gap-3 rounded-md px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <Link
                  className="group min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                  href={`/events/${eventChapterSlug}/${event.slug}`}
                >
                  <span className="font-semibold group-hover:underline">
                    {event.title}
                  </span>
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
                </Link>
                {canManageChapter && (
                  <Link
                    aria-label={`Edit ${event.title}`}
                    className={classes.secondaryButton}
                    href={`/organizer/events/${event.id}/settings`}
                  >
                    Edit
                  </Link>
                )}
              </div>
            ))}
            {(chapter?.upcomingEvents ?? []).length === 0 && (
              <ManagementEmptyState>
                No upcoming events are listed.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection title="Previous events">
          <div className={`divide-y ${classes.divider}`}>
            {(chapter?.previousEvents ?? []).map(event => (
              <div
                key={event.id}
                className="grid gap-3 rounded-md px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <Link
                  className="group min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                  href={`/events/${eventChapterSlug}/${event.slug}`}
                >
                  <span className="font-semibold group-hover:underline">
                    {event.title}
                  </span>
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
                </Link>
                {canManageChapter && (
                  <Link
                    aria-label={`Edit ${event.title}`}
                    className={classes.secondaryButton}
                    href={`/organizer/events/${event.id}/settings`}
                  >
                    Edit
                  </Link>
                )}
              </div>
            ))}
            {(chapter?.previousEvents ?? []).length === 0 && (
              <ManagementEmptyState>
                No previous events are listed.
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
          {membership?.status === 'ACTIVE' && (
            <div className="ml-auto flex flex-wrap justify-end gap-3">
              <button
                className={classes.secondaryButton}
                disabled={isActing}
                onClick={openPreferences}
                type="button"
              >
                Preferences
              </button>
              {membership.role !== 'ADMIN' && (
                <button
                  className={`${
                    classes.isDarkMode
                      ? 'border-red-800 bg-red-950/30 text-red-200 hover:bg-red-950/60'
                      : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  } inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={isActing}
                  onClick={leaveChapter}
                  type="button"
                >
                  Leave chapter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {membership?.status === 'ACTIVE' && isPreferencesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closePreferences}
        >
          <div
            aria-labelledby="notification-preferences-title"
            aria-modal="true"
            className={`${classes.panel} w-full max-w-md p-5`}
            onClick={event => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-xl font-bold"
                  id="notification-preferences-title"
                >
                  Notification preferences
                </h2>
                <p className={`mt-1 text-sm ${classes.mutedText}`}>
                  Choose how this chapter can contact you.
                </p>
              </div>
              <button
                aria-label="Close preferences"
                className={classes.ghostButton}
                disabled={isActing}
                onClick={closePreferences}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="grid gap-3">
              {actionError && (
                <ManagementAlert tone="danger">{actionError}</ManagementAlert>
              )}
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  aria-label="Allow notifications"
                  className={classes.checkbox}
                  checked={notificationsAllowed}
                  onChange={event => setAllNotifications(event.target.checked)}
                  type="checkbox"
                />
                Allow notifications
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  aria-label="Email"
                  className={classes.checkbox}
                  checked={emailNotificationsEnabled}
                  disabled={!notificationsAllowed}
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
                  disabled={!notificationsAllowed}
                  onChange={event =>
                    setSmsNotificationsEnabled(event.target.checked)
                  }
                  type="checkbox"
                />
                SMS
              </label>
              <div className="mt-2 flex justify-end gap-3">
                <button
                  className={classes.secondaryButton}
                  disabled={isActing}
                  onClick={closePreferences}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={classes.primaryButton}
                  disabled={isActing}
                  onClick={updateNotifications}
                  type="button"
                >
                  {isActing ? 'Saving...' : 'Save preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManagementPage>
  );
}
