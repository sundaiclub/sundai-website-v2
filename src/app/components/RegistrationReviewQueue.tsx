'use client';

import { useEffect, useState } from 'react';
import type {
  OrganizerRegistrationReviewRow,
  RegistrationStatus,
  TemplateFieldDefinition,
} from '@/types/event-management';
import {
  ManagementBadge,
  ManagementEmptyState,
  useManagementClasses,
} from './ManagementSurface';

const REVIEW_STATUSES: RegistrationStatus[] = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'CANCELLED',
  'BLOCKED',
];

function answerLabel(
  field: TemplateFieldDefinition,
  row: OrganizerRegistrationReviewRow
) {
  const value = row.answersJson?.[field.id];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function RegistrationReviewTabs({
  activeStatus,
  counts,
  onChange,
}: {
  activeStatus: RegistrationStatus;
  counts: Partial<Record<RegistrationStatus, number>>;
  onChange: (status: RegistrationStatus) => void;
}) {
  const classes = useManagementClasses();

  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {REVIEW_STATUSES.filter(status => status !== 'BLOCKED').map(status => (
        <button
          aria-selected={activeStatus === status}
          className={
            activeStatus === status
              ? classes.primaryButton
              : classes.secondaryButton
          }
          key={status}
          onClick={() => onChange(status)}
          role="tab"
          type="button"
        >
          <span>{status.toLowerCase()}</span>
          <ManagementBadge>{counts[status] ?? 0}</ManagementBadge>
        </button>
      ))}
    </div>
  );
}

function RegistrationReviewRow({
  row,
  onDecision,
  onSaveNotes,
}: {
  row: OrganizerRegistrationReviewRow;
  onDecision: (
    row: OrganizerRegistrationReviewRow,
    status: RegistrationStatus
  ) => void;
  onSaveNotes: (
    row: OrganizerRegistrationReviewRow,
    notes: string
  ) => Promise<void>;
}) {
  const classes = useManagementClasses();
  const initialNotes = row.activeBan ? '' : (row.internalReviewNotes ?? '');
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  >('idle');

  useEffect(() => {
    const nextNotes = row.activeBan ? '' : (row.internalReviewNotes ?? '');
    setNotes(nextNotes);
    setSavedNotes(nextNotes);
    setSaveState('idle');
  }, [row.activeBan, row.id, row.internalReviewNotes]);

  async function saveNotes() {
    setSaveState('saving');
    try {
      await onSaveNotes(row, notes);
      setSavedNotes(notes);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <article className={`${classes.panel} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">{row.applicant.name}</h2>
          <p className={`text-sm ${classes.mutedText}`}>
            {row.applicant.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManagementBadge>{row.status}</ManagementBadge>
          {row.activeBan && (
            <ManagementBadge tone="danger">Ban context</ManagementBadge>
          )}
        </div>
      </div>

      {row.activeBan && row.capabilities.canViewBanContext && (
        <div className="mt-4 text-sm text-red-700">
          {row.internalReviewNotes}
          <div>{row.activeBan.publicSafeReason}</div>
        </div>
      )}

      <dl className="mt-4 grid gap-3">
        {(row.templateSnapshotJson ?? []).map(field => {
          if (field.id === 'name' || field.id === 'email') return null;
          const value = answerLabel(field, row);
          if (!value) return null;
          return (
            <div key={field.id}>
              <dt
                className={`text-xs font-bold uppercase ${classes.mutedText}`}
              >
                {field.label}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">
                {field.type === 'URL' ? (
                  <a
                    className="break-all underline underline-offset-2"
                    href={value}
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

      {row.organizerNoteBody && (
        <p className={`mt-4 text-sm ${classes.mutedText}`}>
          {row.organizerNoteBody}
        </p>
      )}

      {row.capabilities.canEditInternalNotes && (
        <div className="mt-4 grid gap-2">
          <label className="text-sm font-semibold" htmlFor={`notes-${row.id}`}>
            Internal review notes
          </label>
          <textarea
            className={classes.textarea}
            disabled={saveState === 'saving'}
            id={`notes-${row.id}`}
            onChange={event => {
              const nextNotes = event.target.value;
              setNotes(nextNotes);
              setSaveState(nextNotes === savedNotes ? 'idle' : 'dirty');
            }}
            value={notes}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={classes.secondaryButton}
              disabled={saveState !== 'dirty'}
              onClick={() => void saveNotes()}
              type="button"
            >
              {saveState === 'saving' ? 'Saving...' : 'Save'}
            </button>
            <span aria-live="polite" className="text-sm" role="status">
              {saveState === 'dirty' && 'Unsaved changes'}
              {saveState === 'saved' && (
                <span className="text-green-700">Saved successfully</span>
              )}
              {saveState === 'error' && (
                <span className="text-red-700">Unable to save changes</span>
              )}
            </span>
          </div>
        </div>
      )}

      {row.capabilities.canDecide && (
        <div className="mt-4 flex flex-wrap gap-2">
          {row.capabilities.canApprove && row.status !== 'APPROVED' && (
            <button
              className={classes.primaryButton}
              onClick={() => onDecision(row, 'APPROVED')}
              type="button"
            >
              Approve
            </button>
          )}
          {row.capabilities.canWaitlist && row.status !== 'WAITLISTED' && (
            <button
              className={classes.secondaryButton}
              onClick={() => onDecision(row, 'WAITLISTED')}
              type="button"
            >
              Waitlist
            </button>
          )}
          {row.capabilities.canDecline && row.status !== 'DECLINED' && (
            <button
              className={classes.secondaryButton}
              onClick={() => onDecision(row, 'DECLINED')}
              type="button"
            >
              Decline
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function RegistrationReviewQueue({
  rows,
  onDecision,
  onSaveNotes,
}: {
  rows: OrganizerRegistrationReviewRow[];
  onDecision: (
    row: OrganizerRegistrationReviewRow,
    status: RegistrationStatus
  ) => void;
  onSaveNotes: (
    row: OrganizerRegistrationReviewRow,
    notes: string
  ) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <ManagementEmptyState>
        No registrations in this queue.
      </ManagementEmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map(row => (
        <RegistrationReviewRow
          key={row.id}
          onDecision={onDecision}
          onSaveNotes={onSaveNotes}
          row={row}
        />
      ))}
    </div>
  );
}
