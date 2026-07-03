'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import {
  HackerSelector,
  type Hacker,
} from '../../../components/HackerSelector';
import type {
  ApplicationTemplateListItem,
  ManageableChapterListItem,
  TemplateFieldDefinition,
} from '@/types/event-management';

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
type ApplicationTemplatePayload =
  | ApplicationTemplateListItem[]
  | {
      templates?: ApplicationTemplateListItem[];
      items?: ApplicationTemplateListItem[];
    }
  | null;

const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '22:00';
const DEFAULT_CAPACITY = '100';

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

function applicationTemplateList(
  payload: ApplicationTemplatePayload
): ApplicationTemplateListItem[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    return payload.templates ?? payload.items ?? [];
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

function templateFields(template: ApplicationTemplateListItem | null) {
  return (template?.fieldsJson ?? template?.fields ?? []).filter(
    (field): field is TemplateFieldDefinition =>
      Boolean(field?.id && field?.label && field?.type)
  );
}

function uniqueFields(fields: TemplateFieldDefinition[]) {
  const seen = new Set<string>();
  return fields.filter(field => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });
}

function formatClock(value: string) {
  const [rawHour, minute = '00'] = value.split(':');
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function toHacker(candidate: StaffCandidate): Hacker {
  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email ?? '',
  };
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextSundayInputValue(from = new Date()) {
  const daysUntilSunday = (7 - from.getDay()) % 7 || 7;
  const nextSunday = new Date(from);
  nextSunday.setDate(from.getDate() + daysUntilSunday);
  return dateInputValue(nextSunday);
}

export default function OrganizerNewEventPage() {
  const classes = useManagementClasses();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [description, setDescription] = useState('');
  const [publicLocation, setPublicLocation] = useState('');
  const [eventDate, setEventDate] = useState(() => nextSundayInputValue());
  const [startClock, setStartClock] = useState(DEFAULT_START_TIME);
  const [endClock, setEndClock] = useState(DEFAULT_END_TIME);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [hasNoCapacityLimit, setHasNoCapacityLimit] = useState(false);
  const [applicationMode, setApplicationMode] = useState('REQUIRES_APPROVAL');
  const [autoPromoteWaitlist, setAutoPromoteWaitlist] = useState(false);
  const [approvedAddress, setApprovedAddress] = useState('');
  const [approvedDetails, setApprovedDetails] = useState('');
  const [selectedMcs, setSelectedMcs] = useState<StaffCandidate[]>([]);
  const [selectedCoMcs, setSelectedCoMcs] = useState<StaffCandidate[]>([]);
  const [isMcModalOpen, setIsMcModalOpen] = useState(false);
  const [isCoMcModalOpen, setIsCoMcModalOpen] = useState(false);
  const [mcSearchTerm, setMcSearchTerm] = useState('');
  const [coMcSearchTerm, setCoMcSearchTerm] = useState('');
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionType, setQuestionType] =
    useState<TemplateFieldDefinition['type']>('TEXT');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<
    TemplateFieldDefinition[]
  >([]);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(
    null
  );
  const draggedQuestionIdRef = useRef<string | null>(null);
  const [templates, setTemplates] = useState<ApplicationTemplateListItem[]>([]);
  const [selectedChapterTemplateId, setSelectedChapterTemplateId] =
    useState('');
  const [templateLoadMessage, setTemplateLoadMessage] = useState('');
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
        const requestedChapterId =
          typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('chapterId');
        setChapters(nextChapters);
        setStaffCandidates(nextStaff);
        const requestedChapter = requestedChapterId
          ? nextChapters.find(chapter => chapter.id === requestedChapterId)
          : null;
        setChapterId(
          current => current || requestedChapter?.id || nextChapters[0]?.id || ''
        );
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
  const startTime = eventDate ? `${eventDate}T${startClock}` : '';
  const endTime = eventDate ? `${eventDate}T${endClock}` : '';
  const filteredMcCandidates = useMemo(
    () =>
      staffCandidates.filter(candidate => {
        if (selectedMcs.some(staff => staff.id === candidate.id)) {
          return false;
        }
        const query = mcSearchTerm.trim().toLowerCase();
        if (!query) return true;
        return (
          candidate.name.toLowerCase().includes(query) ||
          (candidate.email ?? '').toLowerCase().includes(query)
        );
      }),
    [mcSearchTerm, selectedMcs, staffCandidates]
  );
  const filteredCoMcCandidates = useMemo(
    () =>
      staffCandidates.filter(candidate => {
        if (selectedCoMcs.some(staff => staff.id === candidate.id)) {
          return false;
        }
        const query = coMcSearchTerm.trim().toLowerCase();
        if (!query) return true;
        return (
          candidate.name.toLowerCase().includes(query) ||
          (candidate.email ?? '').toLowerCase().includes(query)
        );
      }),
    [coMcSearchTerm, selectedCoMcs, staffCandidates]
  );
  const siteRequiredFields = useMemo(
    () =>
      templates
        .filter(template => template.scope === 'SITE' && template.isActive)
        .flatMap(template => templateFields(template))
        .filter(field => field.siteRequired),
    [templates]
  );
  const chapterTemplates = useMemo(
    () => templates.filter(template => template.scope === 'CHAPTER'),
    [templates]
  );
  const selectedChapterTemplate = useMemo(
    () =>
      chapterTemplates.find(
        template => template.id === selectedChapterTemplateId
      ) ?? null,
    [chapterTemplates, selectedChapterTemplateId]
  );
  const selectedChapterTemplateFields = useMemo(
    () => templateFields(selectedChapterTemplate),
    [selectedChapterTemplate]
  );
  const orderedApplicationQuestions = useMemo(() => {
    const fields = uniqueFields([
      ...selectedChapterTemplateFields,
      ...customQuestions,
    ]);
    const fieldsById = new Map(fields.map(field => [field.id, field]));
    const orderedFields = questionOrder
      .map(fieldId => fieldsById.get(fieldId))
      .filter((field): field is TemplateFieldDefinition => Boolean(field));
    const orderedIds = new Set(orderedFields.map(field => field.id));
    const remainingFields = fields.filter(field => !orderedIds.has(field.id));

    return [...orderedFields, ...remainingFields];
  }, [customQuestions, questionOrder, selectedChapterTemplateFields]);
  const canSubmit = Boolean(
    title.trim() &&
      description.trim() &&
      publicLocation.trim() &&
      eventDate &&
      startClock &&
      endClock &&
      (hasNoCapacityLimit || capacity.trim())
  );

  useEffect(() => {
    if (!chapterId) {
      setTemplates([]);
      setSelectedChapterTemplateId('');
      return;
    }

    let isCurrent = true;
    setTemplateLoadMessage('');

    fetch(`/api/application-templates?chapterId=${chapterId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<ApplicationTemplatePayload>;
      })
      .then(payload => {
        if (!isCurrent) return;
        setTemplates(applicationTemplateList(payload));
        setSelectedChapterTemplateId('');
      })
      .catch(() => {
        if (!isCurrent) return;
        setTemplates([]);
        setSelectedChapterTemplateId('');
        setTemplateLoadMessage('Unable to load application templates.');
      });

    return () => {
      isCurrent = false;
    };
  }, [chapterId]);

  function updateTitle(value: string) {
    setTitle(value);
    setSlug(slugify(value));
  }

  function addMc(hacker: Hacker) {
    setSelectedMcs(current =>
      current.some(staff => staff.id === hacker.id)
        ? current
        : [...current, hacker]
    );
    setMcSearchTerm('');
  }

  function addCoMc(hacker: Hacker) {
    setSelectedCoMcs(current =>
      current.some(staff => staff.id === hacker.id)
        ? current
        : [...current, hacker]
    );
    setCoMcSearchTerm('');
  }

  function removeMc(hackerId: string) {
    setSelectedMcs(current => current.filter(staff => staff.id !== hackerId));
  }

  function removeCoMc(hackerId: string) {
    setSelectedCoMcs(current =>
      current.filter(staff => staff.id !== hackerId)
    );
  }

  function removeCustomQuestion(questionId: string) {
    setCustomQuestions(current =>
      current.filter(question => question.id !== questionId)
    );
    setQuestionOrder(current => current.filter(fieldId => fieldId !== questionId));
  }

  function moveApplicationQuestion(targetQuestionId: string) {
    const activeDraggedQuestionId =
      draggedQuestionIdRef.current ?? draggedQuestionId;
    if (
      !activeDraggedQuestionId ||
      activeDraggedQuestionId === targetQuestionId
    ) {
      return;
    }

    const currentOrder = orderedApplicationQuestions.map(field => field.id);
    const fromIndex = currentOrder.indexOf(activeDraggedQuestionId);
    const toIndex = currentOrder.indexOf(targetQuestionId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextOrder = [...currentOrder];
    const [movedQuestionId] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, movedQuestionId);
    setQuestionOrder(nextOrder);
    draggedQuestionIdRef.current = null;
    setDraggedQuestionId(null);
  }

  function addCustomQuestion() {
    const label = questionLabel.trim();
    if (!label) return;

    const existingIds = new Set([
      ...selectedChapterTemplateFields.map(field => field.id),
      ...customQuestions.map(field => field.id),
    ]);
    const baseId = slugify(label) || 'question';
    let id = baseId;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const field: TemplateFieldDefinition = {
      id,
      label,
      type: questionType,
      required: questionRequired,
    };
    setCustomQuestions(current => [...current, field]);
    setQuestionLabel('');
    setQuestionType('TEXT');
    setQuestionRequired(false);
  }

  function buildEventPayload() {
    const staff = [
      ...selectedMcs.map(staffMember => ({
        hackerId: staffMember.id,
        role: 'MC' as const,
      })),
      ...selectedCoMcs.map(staffMember => ({
        hackerId: staffMember.id,
        role: 'CO_MC' as const,
      })),
    ];
    const applicationQuestionsJson = orderedApplicationQuestions.map(
      (field, index) => ({
        ...field,
        order: index,
      })
    );

    return {
      chapterId,
      title,
      slug,
      description,
      publicLocation,
      startTime,
      endTime,
      timezone,
      capacity: hasNoCapacityLimit ? null : Number(capacity),
      applicationMode,
      autoPromoteWaitlist,
      approvedDetailsJson: {
        address: approvedAddress,
        details: approvedDetails,
      },
      staff,
      applicationQuestionsJson,
      hideChapterDefaultQuestions: true,
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
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Title</span>
              <input
                aria-label="Title"
                className={classes.input}
                onChange={event => updateTitle(event.target.value)}
                required
                value={title}
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
              <span className="text-sm font-semibold">Event day</span>
              <input
                aria-label="Event day"
                className={classes.input}
                onChange={event => setEventDate(event.target.value)}
                required
                type="date"
                value={eventDate}
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Time</span>
              <div
                className={`${classes.subtlePanel} flex min-h-11 flex-wrap items-center justify-between gap-3 px-3 py-2`}
              >
                <span className="text-sm">
                  {formatClock(startClock)} to {formatClock(endClock)}
                </span>
                <button
                  className={classes.secondaryButton}
                  onClick={() => setIsTimeModalOpen(true)}
                  type="button"
                >
                  Change time
                </button>
              </div>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Capacity</span>
              <input
                aria-label="Capacity"
                className={classes.input}
                disabled={hasNoCapacityLimit}
                onChange={event => setCapacity(event.target.value)}
                required={!hasNoCapacityLimit}
                type="number"
                value={capacity}
              />
            </label>
            <label className="flex items-center gap-2 pt-7">
              <input
                aria-label="No capacity limit"
                checked={hasNoCapacityLimit}
                className={classes.checkbox}
                onChange={event =>
                  setHasNoCapacityLimit(event.target.checked)
                }
                type="checkbox"
              />
              <span className="text-sm font-semibold">No capacity limit</span>
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
            <div className="grid gap-2">
              <span className="text-sm font-semibold">MCs</span>
              <div className="flex min-h-8 flex-wrap items-center gap-2">
                {selectedMcs.map(staff => (
                  <ManagementBadge key={staff.id}>
                    {staff.name}
                    <button
                      aria-label={`Remove ${staff.name} from MCs`}
                      className="ml-2"
                      onClick={() => removeMc(staff.id)}
                      type="button"
                    >
                      x
                    </button>
                  </ManagementBadge>
                ))}
                {selectedMcs.length === 0 && (
                  <span className={`text-sm ${classes.mutedText}`}>
                    No MCs selected
                  </span>
                )}
              </div>
              <button
                aria-label="MCs"
                className={classes.secondaryButton}
                onClick={() => setIsMcModalOpen(true)}
                type="button"
              >
                Add MCs
              </button>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Co-MCs</span>
              <div className="flex min-h-8 flex-wrap items-center gap-2">
                {selectedCoMcs.map(staff => (
                  <ManagementBadge key={staff.id}>
                    {staff.name}
                    <button
                      aria-label={`Remove ${staff.name} from Co-MCs`}
                      className="ml-2"
                      onClick={() => removeCoMc(staff.id)}
                      type="button"
                    >
                      x
                    </button>
                  </ManagementBadge>
                ))}
                {selectedCoMcs.length === 0 && (
                  <span className={`text-sm ${classes.mutedText}`}>
                    No co-MCs selected
                  </span>
                )}
              </div>
              <button
                aria-label="Co-MCs"
                className={classes.secondaryButton}
                onClick={() => setIsCoMcModalOpen(true)}
                type="button"
              >
                Add Co-MCs
              </button>
            </div>
          </div>
        </ManagementSection>

        <ManagementSection
          title="Application questions"
        >
          <div className="grid gap-4">
            {templateLoadMessage && (
              <ManagementAlert tone="warning">
                {templateLoadMessage}
              </ManagementAlert>
            )}
            <label className="grid gap-2">
              <span className="text-sm font-semibold">
                Chapter application template
              </span>
              <select
                aria-label="Chapter application template"
                className={classes.input}
                onChange={event =>
                  setSelectedChapterTemplateId(event.target.value)
                }
                value={selectedChapterTemplateId}
              >
                <option value="">No chapter template</option>
                {chapterTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">
                Required site questions
              </span>
              <div className={`${classes.subtlePanel} grid gap-2 p-3`}>
                {siteRequiredFields.map(field => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={field.id}
                  >
                    <span>{field.label}</span>
                    <ManagementBadge>{field.type}</ManagementBadge>
                  </div>
                ))}
                {siteRequiredFields.length === 0 && (
                  <ManagementEmptyState>
                    No active site-required questions loaded.
                  </ManagementEmptyState>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">
                Application questions
              </span>
              <div className={`${classes.subtlePanel} grid gap-2 p-3`}>
                {orderedApplicationQuestions.map(field => (
                  <div
                    aria-label={`Drag application question ${field.label}`}
                    className={`grid gap-2 rounded-md border px-3 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center ${
                      classes.isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                    draggable
                    key={field.id}
                    role="button"
                    tabIndex={0}
                    onDragOver={event => event.preventDefault()}
                    onDragStart={() => {
                      draggedQuestionIdRef.current = field.id;
                      setDraggedQuestionId(field.id);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      moveApplicationQuestion(field.id);
                    }}
                  >
                    <span className={classes.mutedText} aria-hidden="true">
                      ::
                    </span>
                    <span>{field.label}</span>
                    <span className="flex flex-wrap gap-2">
                      {selectedChapterTemplateFields.some(
                        templateField => templateField.id === field.id
                      ) ? (
                        <ManagementBadge>Chapter template</ManagementBadge>
                      ) : (
                        <>
                          <ManagementBadge>Custom</ManagementBadge>
                          <ManagementBadge>
                            {field.required ? 'Required' : 'Optional'}
                          </ManagementBadge>
                        </>
                      )}
                      <ManagementBadge>{field.type}</ManagementBadge>
                    </span>
                    {customQuestions.some(question => question.id === field.id) ? (
                      <button
                        aria-label={`Remove custom question ${field.label}`}
                        className={classes.ghostButton}
                        onClick={() => removeCustomQuestion(field.id)}
                        type="button"
                      >
                        x
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>
                ))}
                {orderedApplicationQuestions.length === 0 && (
                  <ManagementEmptyState>
                    No application questions selected.
                  </ManagementEmptyState>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  Custom question label
                </span>
                <input
                  aria-label="Custom question label"
                  className={classes.input}
                  onChange={event => setQuestionLabel(event.target.value)}
                  value={questionLabel}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  Custom question type
                </span>
                <select
                  aria-label="Custom question type"
                  className={classes.input}
                  onChange={event =>
                    setQuestionType(
                      event.target.value as TemplateFieldDefinition['type']
                    )
                  }
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
                  aria-label="Required custom question"
                  checked={questionRequired}
                  className={classes.checkbox}
                  onChange={event => setQuestionRequired(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm font-semibold">
                  Required custom question
                </span>
              </label>
              <div className="sm:col-span-2">
                <button
                  className={classes.secondaryButton}
                  disabled={!questionLabel.trim()}
                  onClick={addCustomQuestion}
                  type="button"
                >
                  Add custom question
                </button>
              </div>
            </div>
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
      {isTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            aria-modal="true"
            className={`${classes.panel} w-full max-w-md p-5`}
            role="dialog"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Change time</h2>
              <button
                className={classes.ghostButton}
                onClick={() => setIsTimeModalOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  Start time of day
                </span>
                <input
                  aria-label="Start time of day"
                  className={classes.input}
                  onChange={event => setStartClock(event.target.value)}
                  type="time"
                  value={startClock}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">End time of day</span>
                <input
                  aria-label="End time of day"
                  className={classes.input}
                  onChange={event => setEndClock(event.target.value)}
                  type="time"
                  value={endClock}
                />
              </label>
              <button
                className={classes.primaryButton}
                onClick={() => setIsTimeModalOpen(false)}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      <HackerSelector
        filteredHackers={filteredMcCandidates.map(toHacker)}
        handleAddMember={addMc}
        isDarkMode={classes.isDarkMode}
        searchTerm={mcSearchTerm}
        selectedIds={selectedMcs.map(staff => staff.id)}
        setSearchTerm={setMcSearchTerm}
        setShowModal={setIsMcModalOpen}
        showModal={isMcModalOpen}
        title="Select MCs"
      />
      <HackerSelector
        filteredHackers={filteredCoMcCandidates.map(toHacker)}
        handleAddMember={addCoMc}
        isDarkMode={classes.isDarkMode}
        searchTerm={coMcSearchTerm}
        selectedIds={selectedCoMcs.map(staff => staff.id)}
        setSearchTerm={setCoMcSearchTerm}
        setShowModal={setIsCoMcModalOpen}
        showModal={isCoMcModalOpen}
        title="Select Co-MCs"
      />
    </ManagementPage>
  );
}
