'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import EventSummaryCard from '../../components/EventSummaryCard';
import { SignInAction } from '../../components/SignInAction';
import {
  SMS_CONSENT_CONFIGURED,
  SMS_CONSENT_COPY,
  SMS_CONSENT_VERSION,
} from '@/lib/smsConsent';
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
  ChapterLandingProject,
  ChapterMembershipSummary,
} from '@/types/event-management';

function firstMembership(
  chapter: ChapterLanding | null
): ChapterMembershipSummary | null {
  return chapter?.viewerMembership ?? null;
}

export default function ChapterLandingPage(props: {
  params: Promise<{ chapterSlug: string }>;
}) {
  const params = use(props.params);
  const classes = useManagementClasses();
  const { isAdmin, userInfo } = useUserContext();
  const [chapter, setChapter] = useState<ChapterLanding | null>(null);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'events' | 'projects' | 'preferences'
  >('events');
  const membership = firstMembership(chapter);
  const canManageChapter =
    Boolean(chapter) &&
    (isAdmin ||
      (Boolean(userInfo) &&
        membership?.role === 'ADMIN' &&
        membership.status === 'ACTIVE'));
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(false);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);
  const [smsConsentGranted, setSmsConsentGranted] = useState(false);

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
        setEmailNotificationsEnabled(
          Boolean(nextMembership?.emailNotificationsEnabled)
        );
        setSmsNotificationsEnabled(
          Boolean(nextMembership?.smsNotificationsEnabled)
        );
        setSmsConsentGranted(
          Boolean(
            nextMembership?.smsNotificationsEnabled &&
              nextMembership.smsConsentAt &&
              nextMembership.smsConsentVersion === SMS_CONSENT_VERSION
          )
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
      const response = await fetch(
        `/api/chapters/${chapter.id}/invites/accept`,
        {
          method: 'POST',
        }
      );
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
      const response = await fetch(
        `/api/chapters/${chapter.id}/notifications`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            notificationsAllowed:
              emailNotificationsEnabled || smsNotificationsEnabled,
            emailNotificationsEnabled,
            smsNotificationsEnabled,
            smsConsentGranted: smsNotificationsEnabled && smsConsentGranted,
          }),
        }
      );
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

  function openPreferences() {
    setEmailNotificationsEnabled(
      Boolean(membership?.emailNotificationsEnabled)
    );
    setSmsNotificationsEnabled(Boolean(membership?.smsNotificationsEnabled));
    setSmsConsentGranted(
      Boolean(
        membership?.smsNotificationsEnabled &&
          membership.smsConsentAt &&
          membership.smsConsentVersion === SMS_CONSENT_VERSION
      )
    );
    setActionMessage('');
    setActionError('');
    setActiveTab('preferences');
  }

  if (denied) {
    return (
      <ManagementPage maxWidth="max-w-6xl">
        <ManagementAlert tone="danger">
          You do not have permission to view this chapter.
        </ManagementAlert>
      </ManagementPage>
    );
  }

  const eventChapterSlug = chapter?.slug ?? params.chapterSlug;
  const pendingEvents = chapter?.pendingEvents ?? [];
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';
  const tabs = [
    { id: 'events' as const, label: 'Events' },
    { id: 'projects' as const, label: 'Projects' },
    { id: 'preferences' as const, label: 'Preferences' },
  ];
  const canJoinChapter =
    chapter?.accessMode === 'PUBLIC' && membership?.status !== 'ACTIVE';
  const canAcceptInvite = membership?.status === 'INVITED';

  function projectRankingSection(
    title: string,
    description: string,
    projects: ChapterLandingProject[]
  ) {
    return (
      <ManagementSection title={title} description={description}>
        {projects.length > 0 ? (
          <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <article
                className={`${classes.panel} overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md`}
                key={project.id}
              >
                <Link
                  aria-label={`View project ${project.title}`}
                  className="group block h-full"
                  href={`/projects/${project.id}`}
                >
                  <div
                    className={`${classes.subtlePanel} relative aspect-[3/2] overflow-hidden rounded-none border-x-0 border-t-0 !bg-black`}
                  >
                    <Image
                      alt={project.thumbnail?.alt || project.title}
                      className={
                        project.thumbnail?.url
                          ? 'object-contain'
                          : 'object-contain p-8'
                      }
                      fill
                      sizes="(min-width: 1024px) 280px, (min-width: 640px) 420px, 100vw"
                      src={
                        project.thumbnail?.url ||
                        (classes.isDarkMode
                          ? '/images/default_project_thumbnail_dark.svg'
                          : '/images/default_project_thumbnail_light.svg')
                      }
                      unoptimized={Boolean(project.thumbnail?.url)}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-bold group-hover:underline">
                        {project.title}
                      </h2>
                      <span className={`shrink-0 text-xs ${classes.mutedText}`}>
                        {project.likeCount}{' '}
                        {project.likeCount === 1 ? 'like' : 'likes'}
                      </span>
                    </div>
                    {project.preview && (
                      <p className={`mt-2 text-sm ${classes.mutedText}`}>
                        {project.preview}
                      </p>
                    )}
                    <p className={`mt-3 text-xs ${classes.mutedText}`}>
                      Led by {project.launchLead.name}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <ManagementEmptyState>
            No projects are listed for this chapter yet.
          </ManagementEmptyState>
        )}
      </ManagementSection>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-6xl">
      {loadError && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError}</ManagementAlert>
        </div>
      )}
      {chapter ? (
        <section
          aria-label="Chapter overview"
          className="mb-8 grid gap-6 md:grid-cols-2 md:items-center"
        >
          <div
            className={`${classes.subtlePanel} relative aspect-[3/2] w-full overflow-hidden rounded-lg !bg-black`}
          >
            <Image
              alt={chapter.heroImage?.alt || `${chapter.name} chapter`}
              className={
                chapter.heroImage?.url
                  ? 'object-contain'
                  : 'object-contain p-10'
              }
              fill
              priority
              src={chapter.heroImage?.url || placeholderLogo}
              sizes="(min-width: 768px) 50vw, 100vw"
              unoptimized={Boolean(chapter.heroImage?.url)}
            />
          </div>
          <div className="min-w-0">
            <ManagementHeader
              title={chapter.name}
              titleMeta={
                <>
                  <ManagementBadge>{chapter.accessMode}</ManagementBadge>
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
              description={chapter.description || chapter.city}
              descriptionSize="large"
            />
            {(actionMessage || actionError) && (
              <div className="mb-5">
                <ManagementAlert tone={actionError ? 'danger' : 'success'}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{actionError || actionMessage}</span>
                    {actionError === 'Please sign in to join this chapter.' && (
                      <SignInAction label="Sign in to join" />
                    )}
                  </div>
                </ManagementAlert>
              </div>
            )}
            {canJoinChapter || canAcceptInvite ? (
              <div className="flex flex-wrap gap-3">
                {canJoinChapter && (
                  <button
                    className={classes.primaryButton}
                    disabled={isActing}
                    onClick={join}
                    type="button"
                  >
                    Join chapter
                  </button>
                )}
                {canAcceptInvite && (
                  <button
                    className={classes.primaryButton}
                    disabled={isActing}
                    onClick={acceptInvite}
                    type="button"
                  >
                    Accept invitation
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <ManagementHeader title="Chapter" />
      )}
      <div
        className={`mb-5 flex flex-wrap items-end gap-x-4 border-b ${
          classes.isDarkMode ? 'border-gray-800' : 'border-gray-300'
        }`}
      >
        <div
          aria-label="Chapter information"
          className="flex gap-1"
          role="tablist"
        >
          {tabs.map(tab => (
            <button
              aria-controls={`chapter-${tab.id}-panel`}
              aria-selected={activeTab === tab.id}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? classes.isDarkMode
                    ? 'border-gray-100 text-gray-100'
                    : 'border-gray-900 text-gray-900'
                  : `border-transparent ${classes.mutedText} hover:border-gray-400`
              }`}
              id={`chapter-${tab.id}-tab`}
              key={tab.id}
              onClick={() => {
                if (tab.id === 'preferences') openPreferences();
                else setActiveTab(tab.id);
              }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {canManageChapter && chapter && (
          <div
            aria-label="Chapter actions"
            className="ml-auto flex flex-wrap gap-2 pb-2"
          >
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
          </div>
        )}
      </div>

      {activeTab === 'events' && (
        <div
          aria-labelledby="chapter-events-tab"
          className="grid gap-5"
          id="chapter-events-panel"
          role="tabpanel"
        >
          {(chapter?.happeningNowEvents ?? []).length > 0 && (
            <ManagementSection title="Happening now">
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                {(chapter?.happeningNowEvents ?? []).map(event => (
                  <EventSummaryCard
                    event={event}
                    href={`/events/${eventChapterSlug}/${event.slug}`}
                    key={event.id}
                    showEdit={canManageChapter}
                    timezone={event.timezone}
                  />
                ))}
              </div>
            </ManagementSection>
          )}

          {canManageChapter && (
            <ManagementSection
              title="Pending events"
              description="Draft, paused, private, and unlisted events for this chapter."
            >
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                {pendingEvents.map(event => (
                  <EventSummaryCard
                    event={event}
                    href={`/organizer/events/${event.id}/settings`}
                    key={event.id}
                    showState
                    timezone={event.timezone}
                  />
                ))}
                {pendingEvents.length === 0 && (
                  <div className="sm:col-span-2">
                    <ManagementEmptyState>
                      No pending events are listed.
                    </ManagementEmptyState>
                  </div>
                )}
              </div>
            </ManagementSection>
          )}

          <ManagementSection title="Upcoming events">
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              {(chapter?.upcomingEvents ?? []).map(event => (
                <EventSummaryCard
                  event={event}
                  href={`/events/${eventChapterSlug}/${event.slug}`}
                  key={event.id}
                  showEdit={canManageChapter}
                  timezone={event.timezone}
                />
              ))}
              {(chapter?.upcomingEvents ?? []).length === 0 && (
                <div className="sm:col-span-2">
                  <ManagementEmptyState>
                    No upcoming events are listed.
                  </ManagementEmptyState>
                </div>
              )}
            </div>
          </ManagementSection>

          <ManagementSection title="Previous events">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(chapter?.previousEvents ?? []).map(event => (
                <EventSummaryCard
                  event={event}
                  href={`/events/${eventChapterSlug}/${event.slug}`}
                  key={event.id}
                  showEdit={canManageChapter}
                  timezone={event.timezone}
                />
              ))}
              {(chapter?.previousEvents ?? []).length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <ManagementEmptyState>
                    No previous events are listed.
                  </ManagementEmptyState>
                </div>
              )}
            </div>
          </ManagementSection>
        </div>
      )}

      {activeTab === 'projects' && (
        <div
          aria-labelledby="chapter-projects-tab"
          className="grid gap-5"
          id="chapter-projects-panel"
          role="tabpanel"
        >
          {projectRankingSection(
            'Top this week',
            'The most-liked projects from this chapter over the last seven days.',
            chapter?.topProjectsThisWeek ?? []
          )}
          {projectRankingSection(
            'Top all time',
            'The most-liked projects from this chapter overall.',
            chapter?.topProjectsAllTime ?? []
          )}
        </div>
      )}

      {activeTab === 'preferences' && (
        <div
          aria-labelledby="chapter-preferences-tab"
          className="grid gap-5"
          id="chapter-preferences-panel"
          role="tabpanel"
        >
          <div className="flex flex-wrap gap-3">
            {membership?.status === 'ACTIVE' && (
              <div className="ml-auto flex flex-wrap justify-end gap-3">
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
          {membership?.status === 'ACTIVE' ? (
            <ManagementSection
              title="Notification preferences"
              description="Choose how this chapter can contact you."
            >
              <div className="grid max-w-md gap-3">
                {actionError && (
                  <ManagementAlert tone="danger">{actionError}</ManagementAlert>
                )}
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
                    disabled={!SMS_CONSENT_CONFIGURED}
                    onChange={event => {
                      setSmsNotificationsEnabled(event.target.checked);
                      if (!event.target.checked) setSmsConsentGranted(false);
                    }}
                    type="checkbox"
                  />
                  SMS
                </label>
                {!SMS_CONSENT_CONFIGURED && (
                  <p className={`text-sm ${classes.mutedText}`} role="status">
                    SMS notifications are unavailable until consent information
                    is configured.
                  </p>
                )}
                {smsNotificationsEnabled && SMS_CONSENT_CONFIGURED && (
                  <div className={`${classes.subtlePanel} grid gap-2 p-3`}>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        aria-label={SMS_CONSENT_COPY}
                        checked={smsConsentGranted}
                        className={`${classes.checkbox} mt-0.5`}
                        onChange={event =>
                          setSmsConsentGranted(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{SMS_CONSENT_COPY}</span>
                    </label>
                    <p className={`text-xs ${classes.mutedText}`}>
                      Consent version {SMS_CONSENT_VERSION}
                    </p>
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-3">
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
            </ManagementSection>
          ) : (
            <ManagementEmptyState>
              Join this chapter to manage notification preferences.
            </ManagementEmptyState>
          )}
        </div>
      )}
    </ManagementPage>
  );
}
