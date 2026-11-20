'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import {
  RegistrationBulkBar,
  RegistrationCapacitySummary,
  RegistrationQueueEmpty,
  RegistrationQueueSkeleton,
  RegistrationReviewDetail,
  RegistrationReviewListItem,
  RegistrationReviewTabs,
  type ReviewDecisionStatus,
} from '../../../../components/RegistrationReviewQueue';
import type {
  OrganizerRegistrationReviewRow,
  OrganizerRegistrationReviewState,
  OrganizerReviewRole,
  RegistrationBulkDecisionResult,
  RegistrationReviewOrder,
  RegistrationStatus,
} from '@/types/event-management';
import {
  fetchRegistrationQueue,
  registrationQueueKey,
  type RegistrationQueueQuery,
} from './registrationQueueClient';

const REVIEW_STATUSES: RegistrationStatus[] = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'CANCELLED',
];
const SEARCH_DEBOUNCE_MS = 250;

type QueueSummary = {
  capacity: number | null;
  counts: Partial<Record<RegistrationStatus, number>>;
  viewerRole: OrganizerReviewRole;
};

type PendingDecision = {
  ids: string[];
  status: ReviewDecisionStatus;
  bulk: boolean;
};

type DeclineConfirmation = { kind: 'single'; rowId: string } | { kind: 'bulk' };

function moveCounts(
  counts: Partial<Record<RegistrationStatus, number>>,
  movedRows: OrganizerRegistrationReviewRow[],
  toStatus: RegistrationStatus
) {
  const next = { ...counts };
  for (const row of movedRows) {
    next[row.status] = Math.max(0, (next[row.status] ?? 1) - 1);
    next[toStatus] = (next[toStatus] ?? 0) + 1;
  }
  return next;
}

export default function OrganizerEventRegistrationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const classes = useManagementClasses();

  const [status, setStatus] = useState<RegistrationStatus>('PENDING');
  const [includeBannedUsers, setIncludeBannedUsers] = useState(false);
  const [order, setOrder] = useState<RegistrationReviewOrder>('oldest');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const query = useMemo<RegistrationQueueQuery>(
    () => ({ status, includeBannedUsers, order, search }),
    [includeBannedUsers, order, search, status]
  );
  const queryKey = registrationQueueKey(query);

  // Loaded queues stay cached by query so switching tabs shows rows at once
  // while a background request refreshes them.
  const [queues, setQueues] = useState<
    Record<string, OrganizerRegistrationReviewState>
  >({});
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);
  const [confirmingDecline, setConfirmingDecline] =
    useState<DeclineConfirmation | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const queue = queues[queryKey] ?? null;
  const rows = useMemo(() => queue?.rows ?? [], [queue]);
  const selectedRow =
    rows.find(row => row.id === selectedId) ?? rows[0] ?? null;
  const canDecide = summary ? summary.viewerRole !== 'CO_MC' : false;
  const isSiteAdmin = summary?.viewerRole === 'SITE_ADMIN';
  const statuses = includeBannedUsers
    ? [...REVIEW_STATUSES, 'BLOCKED' as const]
    : REVIEW_STATUSES;

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearch(searchInput),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCheckedIds(new Set());
    setConfirmingDecline(null);
    setActionError('');
  }, [queryKey]);

  useEffect(() => {
    let isCurrent = true;
    setLoadError('');

    fetchRegistrationQueue(eventId, query).then(result => {
      if (!isCurrent) return;
      if (!result.ok) {
        setLoadError(
          result.status === 403
            ? "You don't have access to this event's RSVPs."
            : "Couldn't load RSVPs. Refresh the page to try again."
        );
        return;
      }
      setQueues(current => ({ ...current, [queryKey]: result.state }));
      setSummary({
        capacity: result.state.capacity,
        counts: result.state.counts,
        viewerRole: result.state.viewerRole,
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [eventId, query, queryKey]);

  function selectRow(rowId: string) {
    setSelectedId(rowId);
    setConfirmingDecline(null);
  }

  function toggleChecked(rowId: string) {
    setConfirmingDecline(null);
    setCheckedIds(current => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function toggleAllChecked() {
    setConfirmingDecline(null);
    setCheckedIds(current =>
      rows.every(row => current.has(row.id))
        ? new Set()
        : new Set(rows.map(row => row.id))
    );
  }

  async function requestDecision(
    movingRows: OrganizerRegistrationReviewRow[],
    toStatus: ReviewDecisionStatus
  ): Promise<string[]> {
    try {
      if (movingRows.length === 1) {
        const response = await fetch(
          `/api/events/${eventId}/registrations/${movingRows[0].id}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: toStatus }),
          }
        );
        return response.ok ? [movingRows[0].id] : [];
      }

      const response = await fetch(
        `/api/events/${eventId}/registrations/decisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            registrationIds: movingRows.map(row => row.id),
            status: toStatus,
          }),
        }
      );
      if (!response.ok) return [];
      const result = (await response.json()) as RegistrationBulkDecisionResult;
      return result.updatedIds;
    } catch {
      return [];
    }
  }

  async function decide(
    rowIds: string[],
    toStatus: ReviewDecisionStatus,
    bulk: boolean
  ) {
    if (pendingDecision) return;
    const key = queryKey;
    const movingRows = rows.filter(
      row =>
        rowIds.includes(row.id) &&
        row.status !== toStatus &&
        row.capabilities.canDecide
    );
    if (movingRows.length === 0) return;

    setActionError('');
    setPendingDecision({
      ids: movingRows.map(row => row.id),
      status: toStatus,
      bulk,
    });
    const updatedIds = new Set(await requestDecision(movingRows, toStatus));
    setPendingDecision(null);
    setConfirmingDecline(null);

    const failedCount = movingRows.length - updatedIds.size;
    if (failedCount > 0) {
      setActionError(
        movingRows.length === 1
          ? `Couldn't update ${movingRows[0].applicant.name}. Try again.`
          : `Couldn't update ${failedCount} of ${movingRows.length} RSVPs. Try again.`
      );
    }
    if (updatedIds.size === 0) return;

    if (selectedRow && updatedIds.has(selectedRow.id)) {
      const index = rows.findIndex(row => row.id === selectedRow.id);
      const nextRow =
        rows.slice(index + 1).find(row => !updatedIds.has(row.id)) ??
        rows
          .slice(0, index)
          .reverse()
          .find(row => !updatedIds.has(row.id));
      setSelectedId(nextRow?.id ?? null);
    }
    setQueues(current => {
      const existing = current[key];
      if (!existing) return current;
      return {
        ...current,
        [key]: {
          ...existing,
          rows: existing.rows.filter(row => !updatedIds.has(row.id)),
        },
      };
    });
    setSummary(current =>
      current
        ? {
            ...current,
            counts: moveCounts(
              current.counts,
              movingRows.filter(row => updatedIds.has(row.id)),
              toStatus
            ),
          }
        : current
    );
    setCheckedIds(current => {
      const next = new Set(current);
      updatedIds.forEach(id => next.delete(id));
      return next;
    });
  }

  const saveNotes = useCallback(
    async (row: OrganizerRegistrationReviewRow, notes: string) => {
      const response = await fetch(
        `/api/events/${eventId}/registrations/${row.id}/notes`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ internalReviewNotes: notes }),
        }
      );
      if (!response.ok) {
        throw new Error('Unable to save internal review notes.');
      }
      setQueues(current =>
        Object.fromEntries(
          Object.entries(current).map(([key, state]) => [
            key,
            {
              ...state,
              rows: state.rows.map(currentRow =>
                currentRow.id === row.id
                  ? { ...currentRow, internalReviewNotes: notes }
                  : currentRow
              ),
            },
          ])
        )
      );
    },
    [eventId]
  );

  async function loadMore() {
    if (!queue || loadingMore) return;
    const key = queryKey;
    setLoadingMore(true);
    const result = await fetchRegistrationQueue(
      eventId,
      query,
      queue.rows.length
    );
    setLoadingMore(false);
    if (!result.ok) {
      setActionError("Couldn't load more RSVPs. Try again.");
      return;
    }
    setQueues(current => {
      const existing = current[key];
      if (!existing) return current;
      const loadedIds = new Set(existing.rows.map(row => row.id));
      return {
        ...current,
        [key]: {
          ...existing,
          rows: [
            ...existing.rows,
            ...result.state.rows.filter(row => !loadedIds.has(row.id)),
          ],
          hasMore: result.state.hasMore,
        },
      };
    });
  }

  function decideSelected(toStatus: ReviewDecisionStatus) {
    if (!selectedRow) return;
    void decide([selectedRow.id], toStatus, false);
  }

  function decideChecked(toStatus: ReviewDecisionStatus) {
    void decide([...checkedIds], toStatus, true);
  }

  const showDetailOnMobile = mobileDetailOpen && selectedRow !== null;
  const allChecked =
    rows.length > 0 && rows.every(row => checkedIds.has(row.id));

  return (
    <ManagementSection
      title="RSVPs"
      description="Review applications and decide who gets a spot."
      actions={
        isSiteAdmin ? (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              checked={includeBannedUsers}
              className={classes.checkbox}
              onChange={event => {
                setIncludeBannedUsers(event.target.checked);
                if (!event.target.checked && status === 'BLOCKED') {
                  setStatus('PENDING');
                }
              }}
              type="checkbox"
            />
            Include banned users
          </label>
        ) : null
      }
    >
      {summary && (
        <div className="mb-5">
          <RegistrationCapacitySummary
            capacity={summary.capacity}
            counts={summary.counts}
          />
        </div>
      )}
      {loadError && (
        <div className="mb-4">
          <ManagementAlert tone="danger">
            <span role="alert">{loadError}</span>
          </ManagementAlert>
        </div>
      )}

      <div className="overflow-x-auto">
        <RegistrationReviewTabs
          activeStatus={status}
          counts={summary?.counts ?? {}}
          onChange={nextStatus => {
            setStatus(nextStatus);
            setSelectedId(null);
            setMobileDetailOpen(false);
          }}
          statuses={statuses}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          aria-label="Search RSVPs"
          className={`${classes.input} w-full sm:max-w-xs`}
          onChange={event => setSearchInput(event.target.value)}
          placeholder="Search name, email, or username"
          type="search"
          value={searchInput}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          Sort
          <select
            className={classes.input}
            onChange={event =>
              setOrder(event.target.value as RegistrationReviewOrder)
            }
            value={order}
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {actionError && (
        <div className="mt-4">
          <ManagementAlert tone="danger">
            <span role="alert">{actionError}</span>
          </ManagementAlert>
        </div>
      )}

      {checkedIds.size > 0 && (
        <div className="mt-4">
          <RegistrationBulkBar
            activeStatus={status}
            confirmingDecline={confirmingDecline?.kind === 'bulk'}
            count={checkedIds.size}
            onCancelDecline={() => setConfirmingDecline(null)}
            onClear={() => setCheckedIds(new Set())}
            onDecision={decideChecked}
            onRequestDecline={() => setConfirmingDecline({ kind: 'bulk' })}
            pendingDecision={
              pendingDecision?.bulk ? pendingDecision.status : null
            }
          />
        </div>
      )}

      <div
        className={`mt-4 grid items-start gap-4 ${
          selectedRow ? 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : ''
        }`}
      >
        <div className={showDetailOnMobile ? 'hidden lg:block' : ''}>
          {!queue ? (
            loadError ? null : (
              <div className={classes.subtlePanel}>
                <RegistrationQueueSkeleton />
              </div>
            )
          ) : rows.length === 0 ? (
            <RegistrationQueueEmpty search={search} status={status} />
          ) : (
            <div className={`${classes.subtlePanel} overflow-hidden`}>
              <div
                className={`flex items-center gap-3 border-b px-3 py-2 text-xs ${classes.border} ${classes.mutedText}`}
              >
                {canDecide && (
                  <input
                    aria-label="Select all loaded RSVPs"
                    checked={allChecked}
                    className={classes.checkbox}
                    onChange={toggleAllChecked}
                    type="checkbox"
                  />
                )}
                <span>
                  {queue.hasMore
                    ? `First ${rows.length} shown`
                    : `${rows.length} shown`}
                </span>
              </div>
              <ul className={`divide-y ${classes.divider}`}>
                {rows.map(row => (
                  <RegistrationReviewListItem
                    canSelect={row.capabilities.canDecide}
                    isChecked={checkedIds.has(row.id)}
                    isSelected={row.id === selectedRow?.id}
                    key={row.id}
                    onSelect={() => {
                      selectRow(row.id);
                      setMobileDetailOpen(true);
                    }}
                    onToggle={() => toggleChecked(row.id)}
                    row={row}
                  />
                ))}
              </ul>
              {queue.hasMore && (
                <div className={`border-t p-3 ${classes.border}`}>
                  <button
                    className={`${classes.secondaryButton} w-full`}
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    type="button"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedRow && (
          <div
            className={`${classes.subtlePanel} p-4 sm:p-5 lg:sticky lg:top-4 ${
              showDetailOnMobile ? '' : 'hidden lg:block'
            }`}
          >
            <RegistrationReviewDetail
              confirmingDecline={
                confirmingDecline?.kind === 'single' &&
                confirmingDecline.rowId === selectedRow.id
              }
              key={selectedRow.id}
              onBack={() => setMobileDetailOpen(false)}
              onCancelDecline={() => setConfirmingDecline(null)}
              onDecision={decideSelected}
              onRequestDecline={() =>
                setConfirmingDecline({ kind: 'single', rowId: selectedRow.id })
              }
              onSaveNotes={saveNotes}
              pendingDecision={
                pendingDecision &&
                !pendingDecision.bulk &&
                pendingDecision.ids.includes(selectedRow.id)
                  ? pendingDecision.status
                  : null
              }
              row={selectedRow}
            />
          </div>
        )}
      </div>
    </ManagementSection>
  );
}
