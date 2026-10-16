'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '../components/ManagementSurface';
import { useUserContext } from '../contexts/UserContext';
import { useOpenSignIn } from '../hooks/useOpenSignIn';
import { normalizeSmsPhoneNumber } from '@/lib/phoneNumbers';
import {
  SMS_CONSENT_CONFIGURED,
  SMS_CONSENT_COPY,
  SMS_CONSENT_VERSION,
} from '@/lib/smsConsent';
import type { ChapterDirectoryItem } from '@/types/event-management';

const PENDING_CHAPTER_PARAM = 'chapter';
// Fresh sign-ups wait on the Clerk webhook to create their builder record.
const JOIN_RETRY_DELAYS_MS = [1500, 3000, 5000];

function list(payload: unknown): ChapterDirectoryItem[] {
  return Array.isArray(payload) ? (payload as ChapterDirectoryItem[]) : [];
}

function membershipStatus(chapter: ChapterDirectoryItem) {
  return (
    chapter.viewerMembership?.status ?? chapter.memberships?.[0]?.status ?? null
  );
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function JoinPage() {
  const classes = useManagementClasses();
  const openSignIn = useOpenSignIn();
  const { userInfo, loading: userLoading } = useUserContext();
  const [chapters, setChapters] = useState<ChapterDirectoryItem[]>([]);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningChapterId, setJoiningChapterId] = useState<string | null>(null);
  const [joinedChapter, setJoinedChapter] =
    useState<ChapterDirectoryItem | null>(null);
  const pendingJoinHandled = useRef(false);
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';

  useEffect(() => {
    if (userLoading) return;
    setLoadError('');
    fetch('/api/chapters')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => setChapters(list(payload)))
      .catch(() => setLoadError('Unable to load chapters.'))
      .finally(() => setChaptersLoaded(true));
  }, [userLoading, userInfo?.id]);

  const join = useCallback(async (chapter: ChapterDirectoryItem) => {
    setJoiningChapterId(chapter.id);
    setJoinError('');
    try {
      let response = await fetch(`/api/chapters/${chapter.id}/join`, {
        method: 'POST',
      });
      for (const delay of JOIN_RETRY_DELAYS_MS) {
        if (response.status !== 401) break;
        await wait(delay);
        response = await fetch(`/api/chapters/${chapter.id}/join`, {
          method: 'POST',
        });
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Unable to join ${chapter.name}.`);
      }
      const membership = await response.json();
      setChapters(current =>
        current.map(item =>
          item.id === chapter.id
            ? { ...item, viewerMembership: membership, memberships: [membership] }
            : item
        )
      );
      setJoinedChapter(chapter);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : `Unable to join ${chapter.name}.`
      );
    } finally {
      setJoiningChapterId(null);
    }
  }, []);

  // Resume a join that started before the visitor signed in.
  useEffect(() => {
    if (pendingJoinHandled.current || userLoading || !chaptersLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const pendingChapterId = params.get(PENDING_CHAPTER_PARAM);
    if (!pendingChapterId) return;
    if (!userInfo) return;

    pendingJoinHandled.current = true;
    params.delete(PENDING_CHAPTER_PARAM);
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`
    );

    const chapter = chapters.find(item => item.id === pendingChapterId);
    if (chapter && membershipStatus(chapter) !== 'ACTIVE') void join(chapter);
  }, [chapters, chaptersLoaded, join, userInfo, userLoading]);

  function handleJoin(chapter: ChapterDirectoryItem) {
    if (!userInfo) {
      openSignIn(
        `/join?${PENDING_CHAPTER_PARAM}=${encodeURIComponent(chapter.id)}`
      );
      return;
    }
    void join(chapter);
  }

  return (
    <ManagementPage>
      <ManagementHeader
        title="Join a chapter"
        description="Join a Sundai chapter to get emails about upcoming events and everything happening at Sundai."
        descriptionSize="large"
      />
      {(loadError || joinError) && (
        <div className="mb-5">
          <ManagementAlert tone="danger">{loadError || joinError}</ManagementAlert>
        </div>
      )}
      <div className="grid gap-3">
        {chapters.map(chapter => {
          const status = membershipStatus(chapter);
          const isMember = status === 'ACTIVE';
          const isJoining = joiningChapterId === chapter.id;
          const canJoin = chapter.accessMode === 'PUBLIC' && !isMember;

          return (
            <article
              key={chapter.id}
              className={`${classes.panel} flex items-center gap-4 p-3 sm:p-4`}
            >
              <Link
                className={`${classes.subtlePanel} relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-md !bg-black sm:w-28`}
                href={`/chapters/${chapter.slug}`}
              >
                <Image
                  alt={chapter.heroImage?.alt || `${chapter.name} chapter`}
                  className={
                    chapter.heroImage?.url
                      ? 'object-contain'
                      : 'object-contain p-2'
                  }
                  fill
                  src={chapter.heroImage?.url || placeholderLogo}
                  sizes="112px"
                  unoptimized={Boolean(chapter.heroImage?.url)}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  className="block truncate font-bold hover:underline sm:text-lg"
                  href={`/chapters/${chapter.slug}`}
                >
                  {chapter.name}
                </Link>
                <div
                  className={`mt-1 line-clamp-2 text-sm ${classes.mutedText}`}
                >
                  {chapter.description || chapter.city}
                </div>
              </div>
              <div className="shrink-0">
                {canJoin ? (
                  <button
                    className={classes.primaryButton}
                    disabled={Boolean(joiningChapterId)}
                    onClick={() => handleJoin(chapter)}
                    type="button"
                  >
                    {isJoining ? 'Joining...' : 'Join'}
                  </button>
                ) : isMember ? (
                  <ManagementBadge tone="success">Joined</ManagementBadge>
                ) : (
                  <ManagementBadge>Invite only</ManagementBadge>
                )}
              </div>
            </article>
          );
        })}
        {chaptersLoaded && !loadError && chapters.length === 0 && (
          <ManagementEmptyState>No chapters are available.</ManagementEmptyState>
        )}
      </div>
      {joinedChapter && userInfo && (
        <JoinedChapterDialog
          chapter={joinedChapter}
          hackerId={userInfo.id}
          initialPhoneNumber={userInfo.phoneNumber ?? ''}
          onClose={() => setJoinedChapter(null)}
        />
      )}
    </ManagementPage>
  );
}

function JoinedChapterDialog({
  chapter,
  hackerId,
  initialPhoneNumber,
  onClose,
}: {
  chapter: ChapterDirectoryItem;
  hackerId: string;
  initialPhoneNumber: string;
  onClose: () => void;
}) {
  const classes = useManagementClasses();
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [smsConsentGranted, setSmsConsentGranted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [savedPhoneNumber, setSavedPhoneNumber] = useState(
    normalizeSmsPhoneNumber(initialPhoneNumber)
  );
  const [isEditingPhone, setIsEditingPhone] = useState(!savedPhoneNumber);

  async function savePhoneNumber(normalizedPhone: string) {
    if (normalizedPhone === savedPhoneNumber) return;
    const profileResponse = await fetch(`/api/hackers/${hackerId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: normalizedPhone }),
    });
    if (!profileResponse.ok) {
      throw new Error('Unable to save your phone number.');
    }
    setSavedPhoneNumber(normalizedPhone);
    setPhoneNumber(normalizedPhone);
    setIsEditingPhone(false);
  }

  async function savePhoneOnly() {
    const normalizedPhone = normalizeSmsPhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      setError('Enter a valid mobile number, like +1 555 123 4567.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await savePhoneNumber(normalizedPhone);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save your phone number.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function enableSms() {
    const normalizedPhone = normalizeSmsPhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      setError('Enter a valid mobile number, like +1 555 123 4567.');
      return;
    }
    if (!smsConsentGranted) {
      setError('Please confirm that you agree to receive text messages.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await savePhoneNumber(normalizedPhone);

      const response = await fetch(
        `/api/chapters/${chapter.id}/notifications`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            notificationsAllowed: true,
            emailNotificationsEnabled: true,
            smsNotificationsEnabled: true,
            smsConsentGranted: true,
          }),
        }
      );
      if (!response.ok) {
        throw new Error('Unable to turn on text messages.');
      }
      setSmsEnabled(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to turn on text messages.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      aria-labelledby="joined-chapter-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <div
        className={`${classes.panel} max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-7`}
        style={{
          backgroundColor: classes.isDarkMode ? '#111827' : '#ffffff',
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-bold uppercase ${classes.mutedText}`}>
              {chapter.name}
            </p>
            <h2
              className="mt-1 text-2xl font-bold"
              id="joined-chapter-dialog-title"
            >
              You joined {chapter.name}
            </h2>
          </div>
          <button
            aria-label="Close"
            className={classes.ghostButton}
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <ManagementAlert tone="success">
          You&apos;re subscribed to email updates about {chapter.name} events
          and news.
        </ManagementAlert>

        {smsEnabled ? (
          <div className="mt-5 grid gap-4">
            <ManagementAlert tone="success">
              Text messages are on. You can change this anytime from the
              chapter&apos;s preferences.
            </ManagementAlert>
            <div className="flex justify-end">
              <button
                className={classes.primaryButton}
                onClick={onClose}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div>
              <h3 className="font-bold">Want text messages too?</h3>
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                {SMS_CONSENT_CONFIGURED
                  ? 'Get event reminders and updates from this chapter by text.'
                  : 'Add your mobile number so this chapter can text you once text messages are available.'}
              </p>
            </div>
            {isEditingPhone ? (
              <label className="grid gap-2 text-sm font-semibold">
                Mobile number
                <input
                  autoComplete="tel"
                  className={classes.input}
                  onChange={event => setPhoneNumber(event.target.value)}
                  placeholder="+1 555 123 4567"
                  type="tel"
                  value={phoneNumber}
                />
              </label>
            ) : (
              <div
                className={`${classes.subtlePanel} flex items-center justify-between gap-3 p-3 text-sm`}
              >
                <div>
                  <div className={`text-xs ${classes.mutedText}`}>
                    Mobile number
                  </div>
                  <div className="font-semibold">{savedPhoneNumber}</div>
                </div>
                <button
                  className={classes.ghostButton}
                  onClick={() => setIsEditingPhone(true)}
                  type="button"
                >
                  Change
                </button>
              </div>
            )}
            {SMS_CONSENT_CONFIGURED && (
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
            {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                className={classes.secondaryButton}
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                {SMS_CONSENT_CONFIGURED || !isEditingPhone
                  ? 'Email only'
                  : 'Skip'}
              </button>
              {SMS_CONSENT_CONFIGURED ? (
                <button
                  className={classes.primaryButton}
                  disabled={
                    isSaving || !smsConsentGranted || !phoneNumber.trim()
                  }
                  onClick={enableSms}
                  type="button"
                >
                  {isSaving ? 'Saving...' : 'Turn on texts'}
                </button>
              ) : (
                isEditingPhone && (
                  <button
                    className={classes.primaryButton}
                    disabled={isSaving || !phoneNumber.trim()}
                    onClick={savePhoneOnly}
                    type="button"
                  >
                    {isSaving ? 'Saving...' : 'Save phone number'}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
