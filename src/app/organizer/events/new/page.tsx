'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import type { ManageableChapterListItem } from '@/types/event-management';

type StaffCandidate = {
  id: string;
  name: string;
  email?: string | null;
};

type ChapterListPayload = ManageableChapterListItem[] | null;
type StaffListPayload =
  | StaffCandidate[]
  | {
      hackers?: StaffCandidate[];
      items?: StaffCandidate[];
    }
  | null;

function chapterList(payload: ChapterListPayload): ManageableChapterListItem[] {
  return Array.isArray(payload) ? payload : [];
}

function staffList(payload: StaffListPayload): StaffCandidate[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    return payload.hackers ?? payload.items ?? [];
  }
  return [];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function OrganizerNewEventPage() {
  const classes = useManagementClasses();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [description, setDescription] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState('');
  const [programType, setProgramType] = useState('');
  const [applicationMode, setApplicationMode] = useState('REQUIRES_APPROVAL');
  const [autoPromoteWaitlist, setAutoPromoteWaitlist] = useState(false);
  const [approvedAddress, setApprovedAddress] = useState('');
  const [approvedDetails, setApprovedDetails] = useState('');
  const [mcId, setMcId] = useState('');
  const [coMcId, setCoMcId] = useState('');
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionType, setQuestionType] = useState('TEXT');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [declineMessage, setDeclineMessage] = useState('');
  const [chapters, setChapters] = useState<ManageableChapterListItem[]>([]);
  const [staffCandidates, setStaffCandidates] = useState<StaffCandidate[]>([]);
  const [message, setMessage] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    setIsCheckingAccess(true);
    setAuthStatus(null);

    async function loadFormData() {
      try {
        const [chaptersResponse, staffResponse] = await Promise.all([
          fetch('/api/chapters?manageable=true'),
          fetch('/api/hackers'),
        ]);
        const nextAuthStatus = authStatusFromResponse(chaptersResponse);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return;
        }

        if (!chaptersResponse.ok) {
          throw new Error(
            `Request failed with status ${chaptersResponse.status}`
          );
        }

        const nextChapters = chapterList(
          (await chaptersResponse.json()) as ChapterListPayload
        );
        const nextStaff = staffResponse.ok
          ? staffList((await staffResponse.json()) as StaffListPayload)
          : [];
        if (!isCurrent) return;
        setChapters(nextChapters);
        setStaffCandidates(nextStaff);
        setChapterId(current => current || nextChapters[0]?.id || '');
      } catch {
        if (isCurrent) setMessage('Unable to verify event permissions.');
      } finally {
        if (isCurrent) setIsCheckingAccess(false);
      }
    }

    loadFormData();

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedChapter = useMemo(
    () => chapters.find(chapter => chapter.id === chapterId) ?? null,
    [chapterId, chapters]
  );
  const timezone = selectedChapter?.timezone ?? '';
  const canSubmit = Boolean(
    title.trim() &&
      slug.trim() &&
      description.trim() &&
      publicLocation.trim() &&
      startTime &&
      endTime &&
      capacity
  );

  function updateTitle(value: string) {
    setTitle(value);
    setSlug(current => current || slugify(value));
  }

  function buildEventPayload() {
    const staff = [
      mcId ? { hackerId: mcId, role: 'MC' } : null,
      coMcId ? { hackerId: coMcId, role: 'CO_MC' } : null,
    ].filter(Boolean);
    const applicationQuestionsJson = questionLabel.trim()
      ? [
          {
            id: slugify(questionLabel) || 'question',
            label: questionLabel,
            type: questionType,
            required: questionRequired,
            order: 10,
          },
        ]
      : [];

    return {
      chapterId,
      title,
      slug,
      description,
      publicLocation,
      startTime,
      endTime,
      timezone,
      capacity: Number(capacity),
      programType,
      publicProgramLabel: programType,
      applicationMode,
      autoPromoteWaitlist,
      approvedDetailsJson: {
        address: approvedAddress,
        details: approvedDetails,
      },
      staff,
      applicationQuestionsJson,
      confirmationMessage,
      waitlistMessage,
      declineMessage,
      visibility: 'PUBLIC',
    };
  }

  async function createEvent(shouldPublish: boolean) {
    setMessage('');
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildEventPayload()),
    });
    const nextAuthStatus = authStatusFromResponse(response);
    if (nextAuthStatus) {
      setAuthStatus(nextAuthStatus);
      return;
    }

    if (!response.ok) {
      setMessage('Unable to save event');
      return;
    }

    const savedEvent = await response.json().catch(() => null);
    if (shouldPublish && savedEvent?.id) {
      const publishResponse = await fetch(
        `/api/events/${savedEvent.id}/publish`,
        {
          method: 'POST',
        }
      );
      if (!publishResponse.ok) {
        setMessage('Event saved, but publishing failed.');
        return;
      }
      setMessage('Event published');
      return;
    }

    setMessage(
      savedEvent?.id
        ? `Event saved. Open settings at /organizer/events/${savedEvent.id}/settings.`
        : 'Event saved'
    );
  }

  if (isCheckingAccess) {
    return (
      <ManagementPage maxWidth="max-w-3xl">
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage maxWidth="max-w-3xl">
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-4xl">
      <div className="mb-4">
        <ManagementBackButton />
      </div>
      <ManagementHeader
        eyebrow="Organizer"
        title="New event"
        description="Create a native RSVP-ready event for a chapter."
      />
      <form
        className="grid gap-5"
        onSubmit={event => {
          event.preventDefault();
          void createEvent(false);
        }}
      >
        <ManagementSection title="Public details">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Chapter</span>
              <select
                aria-label="Chapter"
                className={classes.input}
                onChange={event => setChapterId(event.target.value)}
                value={chapterId}
              >
                {chapters.map(chapter => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Timezone</span>
              <input
                aria-label="Timezone"
                className={classes.input}
                readOnly
                value={timezone}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Title</span>
              <input
                aria-label="Title"
                className={classes.input}
                onChange={event => updateTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Slug</span>
              <input
                aria-label="Slug"
                className={classes.input}
                onChange={event => setSlug(event.target.value)}
                required
                value={slug}
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Public description</span>
              <textarea
                aria-label="Public description"
                className={classes.textarea}
                onChange={event => setDescription(event.target.value)}
                required
                value={description}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Public location</span>
              <input
                aria-label="Public location"
                className={classes.input}
                onChange={event => setPublicLocation(event.target.value)}
                required
                value={publicLocation}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Program template</span>
              <input
                aria-label="Program template"
                className={classes.input}
                onChange={event => setProgramType(event.target.value)}
                value={programType}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Start time</span>
              <input
                aria-label="Start time"
                className={classes.input}
                onChange={event => setStartTime(event.target.value)}
                required
                type="datetime-local"
                value={startTime}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">End time</span>
              <input
                aria-label="End time"
                className={classes.input}
                onChange={event => setEndTime(event.target.value)}
                required
                type="datetime-local"
                value={endTime}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Capacity</span>
              <input
                aria-label="Capacity"
                className={classes.input}
                onChange={event => setCapacity(event.target.value)}
                required
                type="number"
                value={capacity}
              />
            </label>
          </div>
        </ManagementSection>

        <ManagementSection title="Approved-only details">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Approved-only address
              </span>
              <input
                aria-label="Approved-only address"
                className={classes.input}
                onChange={event => setApprovedAddress(event.target.value)}
                value={approvedAddress}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Approved-only details
              </span>
              <textarea
                aria-label="Approved-only details"
                className={classes.textarea}
                onChange={event => setApprovedDetails(event.target.value)}
                value={approvedDetails}
              />
            </label>
          </div>
        </ManagementSection>

        <ManagementSection title="Registration">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Application mode</span>
              <select
                aria-label="Application mode"
                className={classes.input}
                onChange={event => setApplicationMode(event.target.value)}
                value={applicationMode}
              >
                <option value="REQUIRES_APPROVAL">REQUIRES_APPROVAL</option>
                <option value="OPEN_RSVP">OPEN_RSVP</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-7">
              <input
                aria-label="Auto-promote waitlist"
                checked={autoPromoteWaitlist}
                className={classes.checkbox}
                onChange={event => setAutoPromoteWaitlist(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold">
                Auto-promote waitlist
              </span>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">MCs</span>
              <select
                aria-label="MCs"
                className={classes.input}
                onChange={event => setMcId(event.target.value)}
                value={mcId}
              >
                <option value="">No MC</option>
                {staffCandidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Co-MCs</span>
              <select
                aria-label="Co-MCs"
                className={classes.input}
                onChange={event => setCoMcId(event.target.value)}
                value={coMcId}
              >
                <option value="">No co-MC</option>
                {staffCandidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ManagementSection>

        <ManagementSection
          title="Application questions"
          actions={
            <button className={classes.secondaryButton} type="button">
              Add application question
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Question label</span>
              <input
                aria-label="Question label"
                className={classes.input}
                onChange={event => setQuestionLabel(event.target.value)}
                value={questionLabel}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Question type</span>
              <select
                aria-label="Question type"
                className={classes.input}
                onChange={event => setQuestionType(event.target.value)}
                value={questionType}
              >
                <option value="TEXT">TEXT</option>
                <option value="TEXTAREA">TEXTAREA</option>
                <option value="EMAIL">EMAIL</option>
                <option value="URL">URL</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                aria-label="Required question"
                checked={questionRequired}
                className={classes.checkbox}
                onChange={event => setQuestionRequired(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-semibold">Required question</span>
            </label>
          </div>
        </ManagementSection>

        <ManagementSection title="Messages">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Confirmation message
              </span>
              <textarea
                aria-label="Confirmation message"
                className={classes.textarea}
                onChange={event => setConfirmationMessage(event.target.value)}
                value={confirmationMessage}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Waitlist message</span>
              <textarea
                aria-label="Waitlist message"
                className={classes.textarea}
                onChange={event => setWaitlistMessage(event.target.value)}
                value={waitlistMessage}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Decline message</span>
              <textarea
                aria-label="Decline message"
                className={classes.textarea}
                onChange={event => setDeclineMessage(event.target.value)}
                value={declineMessage}
              />
            </label>
          </div>
        </ManagementSection>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className={classes.primaryButton}
            disabled={!canSubmit}
            type="submit"
          >
            Save draft
          </button>
          <button
            className={classes.secondaryButton}
            disabled={!canSubmit}
            onClick={() => void createEvent(true)}
            type="button"
          >
            Publish
          </button>
          {message && (
            <ManagementAlert
              tone={message.startsWith('Unable') ? 'danger' : 'success'}
            >
              {message}
            </ManagementAlert>
          )}
        </div>
      </form>
    </ManagementPage>
  );
}
