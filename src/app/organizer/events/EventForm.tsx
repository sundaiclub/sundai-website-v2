'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { HackerSelector } from '../../components/HackerSelector';
import type { HackerSelectionOption } from '@/types/hacker';
import type {
  ApplicationTemplateListItem,
  JsonValue,
  ManageableChapterListItem,
  OrganizerEventSettings,
  TemplateFieldDefinition,
} from '@/types/event-management';
import { DEFAULT_EVENT_MESSAGES } from '@/lib/eventMessageDefaults';

type ChapterListPayload = ManageableChapterListItem[] | null;
type StaffListPayload =
  | HackerSelectionOption[]
  | {
      hackers?: HackerSelectionOption[];
      items?: HackerSelectionOption[];
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

function staffList(payload: StaffListPayload): HackerSelectionOption[] {
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

function applicationQuestionTypeLabel(type: TemplateFieldDefinition['type']) {
  return type === 'CHECKBOX' ? 'Checkbox' : type;
}

function formatClock(value: string) {
  const [rawHour, minute = '00'] = value.split(':');
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
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

function fieldsFromJson(
  value: JsonValue | null | undefined
): TemplateFieldDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap(field => {
    if (
      !field ||
      typeof field !== 'object' ||
      Array.isArray(field) ||
      typeof field.id !== 'string' ||
      typeof field.label !== 'string' ||
      typeof field.type !== 'string'
    ) {
      return [];
    }

    return [field as unknown as TemplateFieldDefinition];
  });
}

function dateTimeParts(
  value: string | Date | null | undefined,
  timezone: string
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    clock: `${part('hour')}:${part('minute')}`,
  };
}

function formatClosedAt(value?: string | Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function OrganizerEventForm({ eventId }: { eventId?: string }) {
  const classes = useManagementClasses();
  const router = useRouter();
  const isEditing = Boolean(eventId);
  const [loadedEvent, setLoadedEvent] = useState<OrganizerEventSettings | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [description, setDescription] = useState('');
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const [eventImagePreview, setEventImagePreview] = useState<string | null>(
    null
  );
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
  const [doorCode, setDoorCode] = useState('');
  const [toolkitUrl, setToolkitUrl] = useState('');
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  const [applicationsCloseReason, setApplicationsCloseReason] = useState('');
  const [selectedMcs, setSelectedMcs] = useState<HackerSelectionOption[]>([]);
  const [selectedCoMcs, setSelectedCoMcs] = useState<HackerSelectionOption[]>(
    []
  );
  const [isMcModalOpen, setIsMcModalOpen] = useState(false);
  const [isCoMcModalOpen, setIsCoMcModalOpen] = useState(false);
  const [mcSearchTerm, setMcSearchTerm] = useState('');
  const [coMcSearchTerm, setCoMcSearchTerm] = useState('');
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionType, setQuestionType] =
    useState<TemplateFieldDefinition['type']>('TEXT');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [questionReusePreviousAnswer, setQuestionReusePreviousAnswer] =
    useState(false);
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
  const [confirmationMessage, setConfirmationMessage] = useState<string>(
    DEFAULT_EVENT_MESSAGES.confirmation
  );
  const [waitlistMessage, setWaitlistMessage] = useState<string>(
    DEFAULT_EVENT_MESSAGES.waitlist
  );
  const [declineMessage, setDeclineMessage] = useState<string>(
    DEFAULT_EVENT_MESSAGES.decline
  );
  const [chapters, setChapters] = useState<ManageableChapterListItem[]>([]);
  const [staffCandidates, setStaffCandidates] = useState<
    HackerSelectionOption[]
  >([]);
  const [message, setMessage] = useState('');
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    setIsCheckingAccess(true);
    setAuthStatus(null);

    async function loadFormData() {
      try {
        const [chaptersResponse, staffResponse, eventResponse] =
          await Promise.all([
            fetch('/api/chapters?manageable=true'),
            fetch('/api/hackers'),
            eventId
              ? fetch(`/api/events/${eventId}?management=true`)
              : Promise.resolve(null),
          ]);
        const accessResponse = eventResponse ?? chaptersResponse;
        const nextAuthStatus = authStatusFromResponse(accessResponse);
        if (nextAuthStatus) {
          if (isCurrent) setAuthStatus(nextAuthStatus);
          return;
        }

        if (!accessResponse.ok) {
          throw new Error(
            `Request failed with status ${accessResponse.status}`
          );
        }

        const nextChapters = chaptersResponse.ok
          ? chapterList((await chaptersResponse.json()) as ChapterListPayload)
          : [];
        const nextStaff = staffResponse.ok
          ? staffList((await staffResponse.json()) as StaffListPayload)
          : [];
        const eventPayload = eventResponse
          ? ((await eventResponse.json()) as OrganizerEventSettings)
          : null;
        if (!isCurrent) return;

        const eventChapter = eventPayload?.chapter
          ? (eventPayload.chapter as ManageableChapterListItem)
          : null;
        const availableChapters =
          eventChapter &&
          !nextChapters.some(chapter => chapter.id === eventChapter.id)
            ? [eventChapter, ...nextChapters]
            : nextChapters;
        const requestedChapterId =
          typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('chapterId');
        setChapters(availableChapters);
        setStaffCandidates(nextStaff);

        if (eventPayload) {
          const eventTimezone = eventPayload.chapter?.timezone ?? 'UTC';
          const start = dateTimeParts(eventPayload.startTime, eventTimezone);
          const end = dateTimeParts(eventPayload.endTime, eventTimezone);
          const questions = fieldsFromJson(
            eventPayload.applicationQuestionsJson
          );
          const approvedDetails = eventPayload.approvedDetailsJson;

          setLoadedEvent(eventPayload);
          setChapterId(eventPayload.chapter?.id ?? '');
          setTitle(eventPayload.title);
          setSlug(eventPayload.slug ?? slugify(eventPayload.title));
          setDescription(eventPayload.description ?? '');
          setEventImagePreview(eventPayload.image?.url ?? null);
          setPublicLocation(eventPayload.publicLocation ?? '');
          if (start) {
            setEventDate(start.date);
            setStartClock(start.clock);
          }
          if (end) setEndClock(end.clock);
          setCapacity(
            eventPayload.capacity === null
              ? DEFAULT_CAPACITY
              : String(eventPayload.capacity ?? DEFAULT_CAPACITY)
          );
          setHasNoCapacityLimit(eventPayload.capacity === null);
          setApplicationMode(
            eventPayload.applicationMode ?? 'REQUIRES_APPROVAL'
          );
          setApplicationsOpen(eventPayload.applicationsOpen !== false);
          setApplicationsCloseReason(
            eventPayload.applicationsCloseReason ?? ''
          );
          setAutoPromoteWaitlist(Boolean(eventPayload.autoPromoteWaitlist));
          setApprovedAddress(
            typeof approvedDetails?.address === 'string'
              ? approvedDetails.address
              : ''
          );
          setApprovedDetails(
            typeof approvedDetails?.details === 'string'
              ? approvedDetails.details
              : ''
          );
          setDoorCode(
            typeof approvedDetails?.doorCode === 'string'
              ? approvedDetails.doorCode
              : ''
          );
          setToolkitUrl(
            typeof approvedDetails?.toolkitUrl === 'string'
              ? approvedDetails.toolkitUrl
              : ''
          );
          setSelectedMcs(
            (eventPayload.staff ?? [])
              .filter(staff => staff.role === 'MC' && staff.hacker)
              .map(staff => ({
                id: staff.hacker!.id,
                name: staff.hacker!.name,
              }))
          );
          setSelectedCoMcs(
            (eventPayload.staff ?? [])
              .filter(staff => staff.role === 'CO_MC' && staff.hacker)
              .map(staff => ({
                id: staff.hacker!.id,
                name: staff.hacker!.name,
              }))
          );
          setCustomQuestions(questions);
          setQuestionOrder(questions.map(question => question.id));
          setConfirmationMessage(
            eventPayload.confirmationMessage ??
              DEFAULT_EVENT_MESSAGES.confirmation
          );
          setWaitlistMessage(
            eventPayload.waitlistMessage ?? DEFAULT_EVENT_MESSAGES.waitlist
          );
          setDeclineMessage(
            eventPayload.declineMessage ?? DEFAULT_EVENT_MESSAGES.decline
          );
          return;
        }

        const requestedChapter = requestedChapterId
          ? availableChapters.find(chapter => chapter.id === requestedChapterId)
          : null;
        setChapterId(
          current =>
            current || requestedChapter?.id || availableChapters[0]?.id || ''
        );
      } catch {
        if (isCurrent) {
          setMessage(
            eventId
              ? 'Unable to load event settings.'
              : 'Unable to verify event permissions.'
          );
        }
      } finally {
        if (isCurrent) setIsCheckingAccess(false);
      }
    }

    loadFormData();

    return () => {
      isCurrent = false;
    };
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (eventImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(eventImagePreview);
      }
    };
  }, [eventImagePreview]);

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
    if (!isEditing) setSlug(slugify(value));
  }

  function selectEventImage(file: File | null) {
    setEventImageFile(file);
    if (file) setEventImagePreview(URL.createObjectURL(file));
  }

  function addMc(hacker: HackerSelectionOption) {
    setSelectedMcs(current =>
      current.some(staff => staff.id === hacker.id)
        ? current
        : [...current, hacker]
    );
    setMcSearchTerm('');
  }

  function addCoMc(hacker: HackerSelectionOption) {
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
    setSelectedCoMcs(current => current.filter(staff => staff.id !== hackerId));
  }

  function removeCustomQuestion(questionId: string) {
    setCustomQuestions(current =>
      current.filter(question => question.id !== questionId)
    );
    setQuestionOrder(current =>
      current.filter(fieldId => fieldId !== questionId)
    );
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
      reusePreviousAnswer: questionReusePreviousAnswer,
    };
    setCustomQuestions(current => [...current, field]);
    setQuestionLabel('');
    setQuestionType('TEXT');
    setQuestionRequired(false);
    setQuestionReusePreviousAnswer(false);
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
        ...(isEditing && { doorCode, toolkitUrl }),
      },
      staff,
      applicationQuestionsJson,
      hideChapterDefaultQuestions: true,
      confirmationMessage,
      waitlistMessage,
      declineMessage,
      ...(!isEditing && { visibility: 'PUBLIC' }),
      ...(isEditing && {
        applicationsOpen,
        applicationsCloseReason,
      }),
    };
  }

  async function saveEvent(shouldPublish: boolean) {
    setMessage('');
    setSavedEventId(null);
    const response = await fetch(
      isEditing ? `/api/events/${eventId}` : '/api/events',
      {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildEventPayload()),
      }
    );
    const nextAuthStatus = authStatusFromResponse(response);
    if (nextAuthStatus) {
      setAuthStatus(nextAuthStatus);
      return;
    }

    if (!response.ok) {
      setMessage(
        isEditing ? 'Unable to save event settings' : 'Unable to save event'
      );
      return;
    }

    const savedEvent = await response.json().catch(() => null);
    if (eventImageFile && savedEvent?.id) {
      const imageFormData = new FormData();
      imageFormData.append('image', eventImageFile);
      const imageResponse = await fetch(`/api/events/${savedEvent.id}/image`, {
        method: 'POST',
        body: imageFormData,
      });
      if (!imageResponse.ok) {
        setSavedEventId(savedEvent.id);
        setMessage('Unable to upload the event image. The event was saved.');
        return;
      }
      const image = await imageResponse.json();
      setEventImageFile(null);
      setEventImagePreview(image.url);
      if (isEditing) {
        setLoadedEvent(current => (current ? { ...current, image } : current));
      }
    }
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
      setSavedEventId(savedEvent.id);
      setMessage('Event was successfully published.');
      if (isEditing) {
        setLoadedEvent(current =>
          current ? { ...current, status: 'PUBLISHED' } : current
        );
      }
      return;
    }

    if (isEditing) {
      setMessage('Event settings saved');
      return;
    }

    if (savedEvent?.id) {
      setSavedEventId(savedEvent.id);
      setMessage('Event draft was successfully created.');
      return;
    }

    setMessage('Event was successfully created.');
  }

  async function deleteDraft() {
    if (
      !eventId ||
      loadedEvent?.status !== 'DRAFT' ||
      !loadedEvent.canDelete ||
      !window.confirm('Delete this draft event? This cannot be undone.')
    ) {
      return;
    }

    setIsDeleting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      const nextAuthStatus = authStatusFromResponse(response);
      if (nextAuthStatus) {
        setAuthStatus(nextAuthStatus);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(
          payload?.message
            ? `Unable to delete draft: ${payload.message}`
            : 'Unable to delete draft.'
        );
        return;
      }

      router.push('/events');
      router.refresh();
    } catch {
      setMessage('Unable to delete draft.');
    } finally {
      setIsDeleting(false);
    }
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

  if (isEditing && !loadedEvent) {
    return (
      <ManagementPage maxWidth="max-w-3xl">
        <ManagementAlert tone="danger">
          {message || 'Unable to load event settings.'}
        </ManagementAlert>
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
        title={isEditing ? loadedEvent?.title || 'Event settings' : 'New event'}
        description={
          isEditing
            ? 'Update this event with the same details available during event creation.'
            : 'Create a native RSVP-ready event for a chapter.'
        }
        actions={
          isEditing ? (
            <>
              {loadedEvent?.status && (
                <ManagementBadge>{loadedEvent.status}</ManagementBadge>
              )}
              {loadedEvent?.visibility && (
                <ManagementBadge>{loadedEvent.visibility}</ManagementBadge>
              )}
            </>
          ) : undefined
        }
      />
      <form
        className="grid gap-5"
        onSubmit={event => {
          event.preventDefault();
          void saveEvent(false);
        }}
      >
        <ManagementSection title="Public details">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Chapter</span>
              <select
                aria-label="Chapter"
                className={classes.input}
                disabled={isEditing}
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
            <div className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Event image</span>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
                <div
                  className={`${classes.subtlePanel} relative aspect-[16/9] overflow-hidden rounded-md`}
                >
                  {eventImagePreview ? (
                    <Image
                      alt={`${title || 'Event'} preview`}
                      className="object-cover"
                      fill
                      src={eventImagePreview}
                      sizes="240px"
                      unoptimized
                    />
                  ) : (
                    <div
                      className={`flex h-full items-center justify-center px-4 text-center text-sm ${classes.mutedText}`}
                    >
                      The Sundai logo will be used when no image is uploaded.
                    </div>
                  )}
                </div>
                <label className="grid gap-2">
                  <span className={`text-sm ${classes.mutedText}`}>
                    JPEG, PNG, WebP, or GIF. Maximum 10 MB.
                  </span>
                  <input
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-label="Event image"
                    className={classes.input}
                    onChange={event =>
                      selectEventImage(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                </label>
              </div>
            </div>
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
                onChange={event => setHasNoCapacityLimit(event.target.checked)}
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
            {isEditing && (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Door code</span>
                  <input
                    aria-label="Door code"
                    className={classes.input}
                    onChange={event => setDoorCode(event.target.value)}
                    value={doorCode}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Toolkit URL</span>
                  <input
                    aria-label="Toolkit"
                    className={classes.input}
                    onChange={event => setToolkitUrl(event.target.value)}
                    value={toolkitUrl}
                  />
                </label>
              </>
            )}
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
              {isEditing && (
                <span className={`text-xs ${classes.mutedText}`}>
                  {applicationMode === 'OPEN_RSVP'
                    ? 'Open RSVP'
                    : 'Requires approval'}
                </span>
              )}
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
            {isEditing && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    aria-label="Applications open"
                    checked={applicationsOpen}
                    className={classes.checkbox}
                    onChange={event =>
                      setApplicationsOpen(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="text-sm font-semibold">
                    {applicationsOpen
                      ? 'Applications open'
                      : 'Applications closed'}
                  </span>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">
                    Application close reason
                  </span>
                  <input
                    aria-label="Application close reason"
                    className={classes.input}
                    disabled={applicationsOpen}
                    onChange={event =>
                      setApplicationsCloseReason(event.target.value)
                    }
                    value={applicationsCloseReason}
                  />
                </label>
                {!applicationsOpen && (
                  <div className={`text-sm ${classes.mutedText}`}>
                    Applications closed
                    {formatClosedAt(loadedEvent?.applicationsClosedAt)
                      ? ` ${formatClosedAt(loadedEvent?.applicationsClosedAt)}`
                      : ''}
                    {applicationsCloseReason
                      ? `: ${applicationsCloseReason}`
                      : ''}
                  </div>
                )}
              </>
            )}
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

        <ManagementSection title="Application questions">
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
                    <ManagementBadge>
                      {applicationQuestionTypeLabel(field.type)}
                    </ManagementBadge>
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
                      <ManagementBadge>
                        {applicationQuestionTypeLabel(field.type)}
                      </ManagementBadge>
                    </span>
                    {customQuestions.some(
                      question => question.id === field.id
                    ) ? (
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
                  <option value="CHECKBOX">Checkbox</option>
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
              <label className="flex items-center gap-2">
                <input
                  aria-label="Reuse previous answer for custom question"
                  checked={questionReusePreviousAnswer}
                  className={classes.checkbox}
                  onChange={event =>
                    setQuestionReusePreviousAnswer(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-sm font-semibold">
                  Reuse answer from a previous application
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
            {isEditing ? 'Save settings' : 'Save draft'}
          </button>
          {(!isEditing || loadedEvent?.status === 'DRAFT') && (
            <button
              className={classes.secondaryButton}
              disabled={!canSubmit}
              onClick={() => void saveEvent(true)}
              type="button"
            >
              Publish
            </button>
          )}
          {isEditing &&
            loadedEvent?.status === 'DRAFT' &&
            loadedEvent.canDelete && (
              <button
                className={`${classes.secondaryButton} !border-red-600 !text-red-600 hover:!bg-red-50`}
                disabled={isDeleting}
                onClick={() => void deleteDraft()}
                type="button"
              >
                {isDeleting ? 'Deleting...' : 'Delete draft'}
              </button>
            )}
          {message && (
            <ManagementAlert
              tone={message.startsWith('Unable') ? 'danger' : 'success'}
            >
              {message}
              {!isEditing && savedEventId && (
                <>
                  {' '}
                  Go to the{' '}
                  <Link
                    className="font-semibold underline"
                    href={`/organizer/events/${savedEventId}/settings`}
                  >
                    event settings page
                  </Link>{' '}
                  if you want to modify it.
                </>
              )}
            </ManagementAlert>
          )}
        </div>
      </form>
      {isTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            aria-modal="true"
            className={`${classes.panel} ${
              classes.isDarkMode ? '!bg-gray-900' : '!bg-white'
            } w-full max-w-md p-5`}
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
                <span className="text-sm font-semibold">Start time of day</span>
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
        filteredHackers={filteredMcCandidates}
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
        filteredHackers={filteredCoMcCandidates}
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
