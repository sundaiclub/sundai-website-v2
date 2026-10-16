'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
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
            ? {
                ...item,
                viewerMembership: membership,
                memberships: [membership],
              }
            : item
        )
      );
      setJoinedChapter(chapter);
    } catch (error) {
      setJoinError(
        error instanceof Error
          ? error.message
          : `Unable to join ${chapter.name}.`
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
    <MotionConfig reducedMotion="user">
      <ManagementPage maxWidth="max-w-5xl">
        <JoinHero />

        <section aria-labelledby="join-chapters-heading" className="mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-2xl font-bold sm:text-3xl"
                id="join-chapters-heading"
              >
                Join a chapter
              </h2>
              <p className={`mt-2 ${classes.mutedText}`}>
                Members get a weekly email with new hacks and Sundai Club news.
                No spam, leave anytime.
              </p>
            </div>
          </div>
          {(loadError || joinError) && (
            <div className="mb-5">
              <ManagementAlert tone="danger">
                {loadError || joinError}
              </ManagementAlert>
            </div>
          )}
          <motion.div
            animate="visible"
            className="grid gap-4"
            initial="hidden"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            {chapters.map(chapter => {
              const status = membershipStatus(chapter);
              const isMember = status === 'ACTIVE';
              const isJoining = joiningChapterId === chapter.id;
              const canJoin = chapter.accessMode === 'PUBLIC' && !isMember;

              return (
                <motion.article
                  key={chapter.id}
                  className={`${classes.panel} group relative overflow-hidden p-3 transition-[border-color,box-shadow] duration-300 hover:shadow-lg sm:p-4 ${
                    classes.isDarkMode
                      ? 'hover:border-amber-500/40 hover:shadow-amber-500/5'
                      : 'hover:border-amber-400/60 hover:shadow-amber-500/10'
                  } ${isMember ? (classes.isDarkMode ? '!border-emerald-800/70' : '!border-emerald-300') : ''}`}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-center gap-4">
                    <Link
                      className={`${classes.subtlePanel} relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-md !bg-black sm:w-32`}
                      href={`/chapters/${chapter.slug}`}
                    >
                      <Image
                        alt={
                          chapter.heroImage?.alt || `${chapter.name} chapter`
                        }
                        className={`${
                          chapter.heroImage?.url
                            ? 'object-contain'
                            : 'object-contain p-2'
                        } transition-transform duration-500 group-hover:scale-105`}
                        fill
                        src={chapter.heroImage?.url || placeholderLogo}
                        sizes="128px"
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
                      {chapter.nextEvent && <NextEventPill chapter={chapter} />}
                    </div>
                    <div className="shrink-0">
                      {canJoin ? (
                        <button
                          className={`${classes.primaryButton} group/join`}
                          disabled={Boolean(joiningChapterId)}
                          onClick={() => handleJoin(chapter)}
                          type="button"
                        >
                          {isJoining ? 'Joining...' : 'Join'}
                          {!isJoining && (
                            <span
                              aria-hidden="true"
                              className="transition-transform duration-200 group-hover/join:translate-x-0.5"
                            >
                              →
                            </span>
                          )}
                        </button>
                      ) : isMember ? (
                        <ManagementBadge tone="success">Joined</ManagementBadge>
                      ) : (
                        <ManagementBadge>Invite only</ManagementBadge>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
          {chaptersLoaded && !loadError && chapters.length === 0 && (
            <ManagementEmptyState>
              No chapters are available.
            </ManagementEmptyState>
          )}
        </section>
        <AnimatePresence>
          {joinedChapter && userInfo && (
            <JoinedChapterDialog
              chapter={joinedChapter}
              hackerId={userInfo.id}
              initialPhoneNumber={userInfo.phoneNumber ?? ''}
              onClose={() => setJoinedChapter(null)}
            />
          )}
        </AnimatePresence>
      </ManagementPage>
    </MotionConfig>
  );
}

function JoinHero() {
  const classes = useManagementClasses();
  const isDark = classes.isDarkMode;

  return (
    <section className="relative isolate overflow-x-clip pb-2 pt-4 sm:pt-8">
      {/* Sunrise glow behind the headline. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.55, 0.8, 0.55], scale: [1, 1.06, 1] }}
        className={`pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-72 w-full max-w-[40rem] rounded-full blur-3xl ${
          isDark
            ? 'bg-[radial-gradient(closest-side,rgba(245,158,11,0.22),rgba(234,88,12,0.08),transparent)]'
            : 'bg-[radial-gradient(closest-side,rgba(251,191,36,0.45),rgba(251,146,60,0.18),transparent)]'
        }`}
        transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 -top-10 -z-20 h-80 ${
          isDark ? 'opacity-[0.07] invert' : 'opacity-[0.09]'
        }`}
        style={{
          backgroundImage: "url('/images/background_sundai.svg')",
          backgroundSize: '260px auto',
          backgroundRepeat: 'repeat',
          WebkitMaskImage:
            'radial-gradient(ellipse at top, black 20%, transparent 70%)',
          maskImage:
            'radial-gradient(ellipse at top, black 20%, transparent 70%)',
        }}
      />

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Build something{' '}
          <span className="relative whitespace-nowrap">
            <span
              className={`bg-gradient-to-r bg-clip-text text-transparent ${
                isDark
                  ? 'from-amber-300 via-orange-400 to-rose-400'
                  : 'from-amber-500 via-orange-600 to-rose-600'
              }`}
            >
              this Sunday
            </span>
            <motion.svg
              aria-hidden="true"
              className={`absolute -bottom-2 left-0 h-3 w-full ${
                isDark ? 'text-orange-400/70' : 'text-orange-500/70'
              }`}
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 200 12"
            >
              <motion.path
                animate={{ pathLength: 1 }}
                d="M2 9 C 50 2, 150 2, 198 8"
                initial={{ pathLength: 0 }}
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3"
                transition={{ delay: 0.5, duration: 0.8, ease: 'easeInOut' }}
              />
            </motion.svg>
          </span>
          .
        </h1>
        <p
          className={`mx-auto mt-6 max-w-2xl font-fira-code text-base leading-7 sm:text-lg ${classes.mutedText}`}
        >
          Sundai is a community of builders who get together, team up, and ship
          AI prototypes in a single day. Pick a chapter near you and we&apos;ll
          let you know about all of the upcoming hacks.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            className={`${classes.primaryButton} px-5`}
            href="#join-chapters-heading"
          >
            Find your chapter
            <span aria-hidden="true">↓</span>
          </a>
          <Link className={`${classes.secondaryButton} px-5`} href="/projects">
            See what people built
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function formatEventDay(startTime: Date | string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(startTime));
}

function NextEventPill({ chapter }: { chapter: ChapterDirectoryItem }) {
  const classes = useManagementClasses();
  const event = chapter.nextEvent;
  if (!event) return null;

  return (
    <Link
      className={`mt-2 inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:underline ${
        classes.isDarkMode
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
      href={`/events/${chapter.slug}/${event.slug}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
      <span className="truncate">
        Next up
        {event.startTime &&
          ` · ${formatEventDay(event.startTime, event.timezone)}`}
        {` · ${event.title}`}
      </span>
    </Link>
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
    <motion.div
      animate={{ opacity: 1 }}
      aria-labelledby="joined-chapter-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`${classes.panel} relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-7`}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        style={{
          backgroundColor: classes.isDarkMode ? '#111827' : '#ffffff',
        }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <JoinedBurst />
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
      </motion.div>
    </motion.div>
  );
}

const BURST_RAYS = Array.from({ length: 8 }, (_, index) => index * 45);

// A one-shot sunburst around the check mark; it plays once and stays put.
function JoinedBurst() {
  return (
    <div aria-hidden="true" className="relative mt-1 h-11 w-11 shrink-0">
      {BURST_RAYS.map(angle => (
        <motion.span
          key={angle}
          animate={{ opacity: [0, 1, 0], scaleY: [0.2, 1, 0.6] }}
          className="absolute left-1/2 top-1/2 h-2.5 w-0.5 rounded-full bg-amber-400"
          initial={{ opacity: 0 }}
          style={{
            rotate: angle,
            transformOrigin: 'center',
            translateX: '-50%',
            translateY: '-50%',
            marginTop: `${-Math.cos((angle * Math.PI) / 180) * 26}px`,
            marginLeft: `${Math.sin((angle * Math.PI) / 180) * 26}px`,
          }}
          transition={{ delay: 0.15, duration: 0.7, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        animate={{ scale: 1, rotate: 0 }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30"
        initial={{ scale: 0, rotate: -45 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
          <motion.path
            animate={{ pathLength: 1 }}
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={{ pathLength: 0 }}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            transition={{ delay: 0.2, duration: 0.35 }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
