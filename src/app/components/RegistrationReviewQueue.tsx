'use client';

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
  onChange,
}: {
  activeStatus: RegistrationStatus;
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
          {status.toLowerCase()}
        </button>
      ))}
    </div>
  );
}

export function RegistrationReviewRow({
  row,
  onDecision,
  onSaveNotes,
}: {
  row: OrganizerRegistrationReviewRow;
  onDecision: (
    row: OrganizerRegistrationReviewRow,
    status: RegistrationStatus
  ) => void;
  onSaveNotes: (row: OrganizerRegistrationReviewRow, notes: string) => void;
}) {
  const classes = useManagementClasses();

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
              <dd className="mt-1 whitespace-pre-wrap text-sm">{value}</dd>
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
            defaultValue={row.activeBan ? '' : (row.internalReviewNotes ?? '')}
            id={`notes-${row.id}`}
          />
          <div>
            <button
              className={classes.secondaryButton}
              onClick={() => {
                const textarea = document.getElementById(
                  `notes-${row.id}`
                ) as HTMLTextAreaElement | null;
                onSaveNotes(row, textarea?.value ?? '');
              }}
              type="button"
            >
              Save internal note
            </button>
          </div>
        </div>
      )}

      {row.capabilities.canDecide && (
        <div className="mt-4 flex flex-wrap gap-2">
          {row.capabilities.canApprove && (
            <button
              className={classes.primaryButton}
              onClick={() => onDecision(row, 'APPROVED')}
              type="button"
            >
              Approve
            </button>
          )}
          {row.capabilities.canWaitlist && (
            <button
              className={classes.secondaryButton}
              onClick={() => onDecision(row, 'WAITLISTED')}
              type="button"
            >
              Waitlist
            </button>
          )}
          {row.capabilities.canDecline && (
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
  onSaveNotes: (row: OrganizerRegistrationReviewRow, notes: string) => void;
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

export { REVIEW_STATUSES };
