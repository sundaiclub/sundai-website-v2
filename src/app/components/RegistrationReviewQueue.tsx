'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type {
  JsonObject,
  OrganizerRegistrationReviewRow,
  RegistrationStatus,
  TemplateFieldDefinition,
} from '@/types/event-management';
import {
  ManagementBadge,
  ManagementEmptyState,
  useManagementClasses,
} from './ManagementSurface';
import { applicationAnswerLabel } from '@/lib/applicationTemplates';
import { normalizeHttpsUrl } from '@/lib/httpsUrls';

export type ReviewDecisionStatus = 'APPROVED' | 'WAITLISTED' | 'DECLINED';

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  WAITLISTED: 'Waitlisted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  BLOCKED: 'Blocked',
};

const DECISIONS: Array<{
  status: ReviewDecisionStatus;
  label: string;
  pendingLabel: string;
}> = [
  {
    status: 'APPROVED',
    label: 'Approve',
    pendingLabel: 'Approving…',
  },
  {
    status: 'WAITLISTED',
    label: 'Waitlist',
    pendingLabel: 'Waitlisting…',
  },
  {
    status: 'DECLINED',
    label: 'Decline',
    pendingLabel: 'Declining…',
  },
];

export function registrationStatusLabel(status: RegistrationStatus) {
  return STATUS_LABELS[status];
}

const relativeTime = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
  style: 'short',
});
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

function timeAgo(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const seconds = Math.round((time - Date.now()) / 1000);
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeTime.format(Math.round(seconds / size), unit);
    }
  }
  return 'just now';
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

// Banned rows reuse internal notes for ban context, which is shown separately.
function hasInternalNotes(row: OrganizerRegistrationReviewRow) {
  return !row.activeBan && Boolean(row.internalReviewNotes?.trim());
}

function isFirstTimeApplicant(row: OrganizerRegistrationReviewRow) {
  return (
    row.applicantHistory.otherEventsApplied === 0 &&
    row.applicantHistory.publicProjects === 0
  );
}

export function RegistrationAnswers({
  answersJson,
  templateSnapshotJson,
}: {
  answersJson?: JsonObject | null;
  templateSnapshotJson?: TemplateFieldDefinition[] | null;
}) {
  const classes = useManagementClasses();

  return (
    <dl className="mt-4 grid gap-3">
      {(templateSnapshotJson ?? []).map(field => {
        if (field.id === 'name' || field.id === 'email') return null;
        const value = applicationAnswerLabel(field, answersJson?.[field.id]);
        if (!value) return null;
        const url = field.type === 'URL' ? normalizeHttpsUrl(value) : null;
        return (
          <div key={field.id}>
            <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
              {field.label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">
              {url?.valid ? (
                <a
                  className="break-all underline underline-offset-2"
                  href={url.normalizedUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function RegistrationCapacitySummary({
  capacity,
  counts,
}: {
  capacity: number | null;
  counts: Partial<Record<RegistrationStatus, number>>;
}) {
  const classes = useManagementClasses();
  const approved = counts.APPROVED ?? 0;
  const waitlisted = counts.WAITLISTED ?? 0;
  const pending = counts.PENDING ?? 0;
  const ratio = capacity ? approved / capacity : 0;
  const barColor =
    ratio > 1
      ? 'bg-red-600'
      : ratio >= 0.9
        ? 'bg-amber-500'
        : classes.isDarkMode
          ? 'bg-gray-100'
          : 'bg-gray-900';

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <p className="shrink-0 text-sm font-bold">
        {capacity
          ? `${approved} / ${capacity} approved`
          : `${approved} approved`}
      </p>
      {capacity ? (
        <div
          aria-label={`${approved} of ${capacity} spots filled`}
          aria-valuemax={capacity}
          aria-valuemin={0}
          aria-valuenow={Math.min(approved, capacity)}
          className={`h-2 w-full min-w-0 overflow-hidden rounded-full sm:flex-1 ${
            classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
          }`}
          role="progressbar"
        >
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
          />
        </div>
      ) : (
        <p className={`text-sm sm:flex-1 ${classes.mutedText}`}>
          No capacity limit
        </p>
      )}
      <p className={`shrink-0 text-sm ${classes.mutedText}`}>
        {waitlisted} waitlisted · {pending} pending
      </p>
    </div>
  );
}

export function RegistrationReviewTabs({
  activeStatus,
  counts,
  statuses,
  onChange,
}: {
  activeStatus: RegistrationStatus;
  counts: Partial<Record<RegistrationStatus, number>>;
  statuses: RegistrationStatus[];
  onChange: (status: RegistrationStatus) => void;
}) {
  const classes = useManagementClasses();

  return (
    <div
      aria-label="RSVP status"
      className="flex min-w-max gap-1 border-b"
      role="tablist"
    >
      {statuses.map(status => {
        const isActive = activeStatus === status;
        return (
          <button
            aria-selected={isActive}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 ${
              isActive
                ? 'border-current'
                : `border-transparent ${classes.mutedText} hover:border-current`
            }`}
            key={status}
            onClick={() => onChange(status)}
            role="tab"
            type="button"
          >
            <span>{registrationStatusLabel(status)}</span>{' '}
            <span
              className={`rounded-full px-2 text-xs ${
                classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              {counts[status] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RegistrationQueueSkeleton() {
  const { isDarkMode } = useManagementClasses();
  const bar = isDarkMode ? 'bg-gray-800' : 'bg-gray-200';

  return (
    <div aria-label="Loading RSVPs" className="grid gap-px" role="status">
      {[0, 1, 2, 3, 4].map(index => (
        <div className="flex animate-pulse items-center gap-3 p-3" key={index}>
          <div className={`h-4 w-4 rounded ${bar}`} />
          <div className="grid flex-1 gap-2">
            <div className={`h-3 w-1/2 rounded ${bar}`} />
            <div className={`h-3 w-1/3 rounded ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RegistrationReviewListItem({
  row,
  isSelected,
  isChecked,
  canSelect,
  onSelect,
  onToggle,
}: {
  row: OrganizerRegistrationReviewRow;
  isSelected: boolean;
  isChecked: boolean;
  canSelect: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const classes = useManagementClasses();
  const appliedAgo = timeAgo(row.submittedAt);
  const history = isFirstTimeApplicant(row)
    ? null
    : [
        plural(row.applicantHistory.otherEventsApplied, 'other event'),
        plural(row.applicantHistory.publicProjects, 'project'),
      ].join(' · ');
  const selectedBackground = classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-100';
  const hoverBackground = classes.isDarkMode
    ? 'hover:bg-gray-800/60'
    : 'hover:bg-gray-50';

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 ${
        isSelected ? selectedBackground : hoverBackground
      }`}
    >
      {canSelect && (
        <input
          aria-label={`Select ${row.applicant.name}`}
          checked={isChecked}
          className={classes.checkbox}
          onChange={onToggle}
          type="checkbox"
        />
      )}
      <button
        aria-current={isSelected ? 'true' : undefined}
        className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
        onClick={onSelect}
        type="button"
      >
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">
            {row.applicant.name}
          </span>
          {row.activeBan && (
            <ManagementBadge tone="danger">Banned</ManagementBadge>
          )}
          {!row.activeBan && !history && (
            <ManagementBadge tone="warning">New</ManagementBadge>
          )}
          {hasInternalNotes(row) && <ManagementBadge>Notes</ManagementBadge>}
        </span>
        <span className={`block truncate text-xs ${classes.mutedText}`}>
          {[appliedAgo, history ?? 'First Sundai event']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
    </li>
  );
}

function InternalNotesEditor({
  row,
  onSave,
}: {
  row: OrganizerRegistrationReviewRow;
  onSave: (row: OrganizerRegistrationReviewRow, notes: string) => Promise<void>;
}) {
  const classes = useManagementClasses();
  const initialNotes = row.activeBan ? '' : (row.internalReviewNotes ?? '');
  const savedNotesPresent = hasInternalNotes(row);
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  >('idle');
  const savedNotes = useRef(initialNotes);
  const latestNotes = useRef(initialNotes);
  const savingNotes = useRef<string | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  async function save(value: string) {
    if (value === savedNotes.current || value === savingNotes.current) return;
    savingNotes.current = value;
    setSaveState('saving');
    try {
      await saveRef.current(row, value);
      savedNotes.current = value;
      setSaveState(latestNotes.current === value ? 'saved' : 'dirty');
    } catch {
      setSaveState('error');
    } finally {
      if (savingNotes.current === value) savingNotes.current = null;
    }
  }

  useEffect(() => {
    if (notes === savedNotes.current) return;
    const timer = window.setTimeout(() => void save(notes), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Save edits that are still waiting for the debounce when the reviewer
  // moves to another applicant.
  useEffect(
    () => () => {
      if (
        latestNotes.current !== savedNotes.current &&
        latestNotes.current !== savingNotes.current
      ) {
        void saveRef.current(row, latestNotes.current).catch(() => undefined);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <details className="mt-5" open={initialNotes.length > 0}>
      <summary className="cursor-pointer text-sm font-semibold">
        Internal review notes
        {savedNotesPresent ? (
          <span className="ml-2">
            <ManagementBadge>Has notes</ManagementBadge>
          </span>
        ) : (
          <span className={`ml-2 font-normal ${classes.mutedText}`}>
            Only organizers see these
          </span>
        )}
      </summary>
      <textarea
        aria-label="Internal review notes"
        className={`${classes.textarea} mt-2 !min-h-24 w-full`}
        onBlur={() => void save(notes)}
        onChange={event => {
          latestNotes.current = event.target.value;
          setNotes(event.target.value);
          setSaveState(
            event.target.value === savedNotes.current ? 'idle' : 'dirty'
          );
        }}
        value={notes}
      />
      <p aria-live="polite" className="mt-1 min-h-5 text-xs" role="status">
        {saveState === 'dirty' && (
          <span className={classes.mutedText}>Unsaved changes</span>
        )}
        {saveState === 'saving' && (
          <span className={classes.mutedText}>Saving…</span>
        )}
        {saveState === 'saved' && (
          <span className="text-green-700">Notes saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-red-700">
            Couldn&apos;t save notes.{' '}
            <button
              className="underline"
              onClick={() => void save(notes)}
              type="button"
            >
              Try again
            </button>
          </span>
        )}
      </p>
    </details>
  );
}

export function RegistrationReviewDetail({
  row,
  pendingDecision,
  confirmingDecline,
  onDecision,
  onRequestDecline,
  onCancelDecline,
  onSaveNotes,
  onBack,
}: {
  row: OrganizerRegistrationReviewRow;
  pendingDecision: ReviewDecisionStatus | null;
  confirmingDecline: boolean;
  onDecision: (status: ReviewDecisionStatus) => void;
  onRequestDecline: () => void;
  onCancelDecline: () => void;
  onSaveNotes: (
    row: OrganizerRegistrationReviewRow,
    notes: string
  ) => Promise<void>;
  onBack: () => void;
}) {
  const classes = useManagementClasses();
  const appliedOn = formatDate(row.submittedAt);
  const decisions = DECISIONS.filter(
    decision =>
      decision.status !== row.status &&
      ((decision.status === 'APPROVED' && row.capabilities.canApprove) ||
        (decision.status === 'WAITLISTED' && row.capabilities.canWaitlist) ||
        (decision.status === 'DECLINED' && row.capabilities.canDecline))
  );

  return (
    <article aria-label={`RSVP from ${row.applicant.name}`}>
      <button
        className={`${classes.ghostButton} -ml-3 mb-2 lg:hidden`}
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">&larr;</span> Back to list
      </button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">
            <Link
              className="underline-offset-2 hover:underline"
              href={`/hacker/${row.applicant.id}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {row.applicant.name}
            </Link>
          </h2>
          <p className={`text-sm ${classes.mutedText}`}>
            {row.applicant.email}
            {appliedOn && ` · Applied ${appliedOn}`}
          </p>
        </div>
        <ManagementBadge>{registrationStatusLabel(row.status)}</ManagementBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ManagementBadge>
          Applied to{' '}
          {plural(row.applicantHistory.otherEventsApplied, 'other event')}
        </ManagementBadge>
        <ManagementBadge>
          Accepted to {row.applicantHistory.otherEventsAccepted}
        </ManagementBadge>
        <ManagementBadge>
          {plural(row.applicantHistory.publicProjects, 'project')}
        </ManagementBadge>
        {isFirstTimeApplicant(row) && (
          <ManagementBadge tone="warning">First Sundai event</ManagementBadge>
        )}
      </div>

      {row.activeBan && row.capabilities.canViewBanContext && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Active ban</p>
          {row.internalReviewNotes && <p>{row.internalReviewNotes}</p>}
          <p>{row.activeBan.publicSafeReason}</p>
        </div>
      )}

      {row.organizerNoteBody && (
        <div className={`${classes.subtlePanel} mt-4 p-3 text-sm`}>
          <p className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            Organizer note
          </p>
          <p className="mt-1 whitespace-pre-wrap">{row.organizerNoteBody}</p>
        </div>
      )}

      <RegistrationAnswers
        answersJson={row.answersJson}
        templateSnapshotJson={row.templateSnapshotJson}
      />

      {row.capabilities.canEditInternalNotes && (
        <InternalNotesEditor onSave={onSaveNotes} row={row} />
      )}

      {row.capabilities.canDecide && decisions.length > 0 && (
        <div className={`mt-5 border-t pt-4 ${classes.border}`}>
          {confirmingDecline ? (
            <div className="flex flex-wrap items-center gap-2" role="alert">
              <p className="mr-2 text-sm">
                Decline {row.applicant.name}? They&apos;ll get a decline
                message.
              </p>
              <button
                className={`${classes.primaryButton} !bg-red-700 !text-white hover:!bg-red-800`}
                disabled={pendingDecision !== null}
                onClick={() => onDecision('DECLINED')}
                type="button"
              >
                {pendingDecision === 'DECLINED'
                  ? 'Declining…'
                  : 'Confirm decline'}
              </button>
              <button
                className={classes.secondaryButton}
                onClick={onCancelDecline}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {decisions.map(decision => (
                <button
                  className={
                    decision.status === 'APPROVED'
                      ? classes.primaryButton
                      : classes.secondaryButton
                  }
                  disabled={pendingDecision !== null}
                  key={decision.status}
                  onClick={() =>
                    decision.status === 'DECLINED'
                      ? onRequestDecline()
                      : onDecision(decision.status)
                  }
                  type="button"
                >
                  {pendingDecision === decision.status
                    ? decision.pendingLabel
                    : decision.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function RegistrationBulkBar({
  count,
  activeStatus,
  pendingDecision,
  confirmingDecline,
  onDecision,
  onRequestDecline,
  onCancelDecline,
  onClear,
}: {
  count: number;
  activeStatus: RegistrationStatus;
  pendingDecision: ReviewDecisionStatus | null;
  confirmingDecline: boolean;
  onDecision: (status: ReviewDecisionStatus) => void;
  onRequestDecline: () => void;
  onCancelDecline: () => void;
  onClear: () => void;
}) {
  const classes = useManagementClasses();
  const label = plural(count, 'RSVP');

  return (
    <div
      aria-label="Bulk actions"
      className={`${classes.subtlePanel} flex flex-wrap items-center gap-2 p-3`}
      role="region"
    >
      {confirmingDecline ? (
        <>
          <p className="mr-2 text-sm font-semibold">
            Decline {label}? Each applicant gets a decline message.
          </p>
          <button
            className={`${classes.primaryButton} !bg-red-700 !text-white hover:!bg-red-800`}
            disabled={pendingDecision !== null}
            onClick={() => onDecision('DECLINED')}
            type="button"
          >
            {pendingDecision === 'DECLINED' ? 'Declining…' : `Decline ${label}`}
          </button>
          <button
            className={classes.secondaryButton}
            onClick={onCancelDecline}
            type="button"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="mr-2 text-sm font-semibold">{count} selected</p>
          {DECISIONS.filter(decision => decision.status !== activeStatus).map(
            decision => (
              <button
                className={classes.secondaryButton}
                disabled={pendingDecision !== null}
                key={decision.status}
                onClick={() =>
                  decision.status === 'DECLINED'
                    ? onRequestDecline()
                    : onDecision(decision.status)
                }
                type="button"
              >
                {pendingDecision === decision.status
                  ? decision.pendingLabel
                  : `${decision.label} selected`}
              </button>
            )
          )}
          <button
            className={classes.ghostButton}
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

export function RegistrationQueueEmpty({
  status,
  search,
}: {
  status: RegistrationStatus;
  search: string;
}) {
  const term = search.trim();
  return (
    <ManagementEmptyState>
      {term
        ? `No ${registrationStatusLabel(status).toLowerCase()} RSVPs match “${term}”.`
        : status === 'PENDING'
          ? 'No RSVPs waiting for review. New applications show up here.'
          : `No ${registrationStatusLabel(status).toLowerCase()} RSVPs.`}
    </ManagementEmptyState>
  );
}
