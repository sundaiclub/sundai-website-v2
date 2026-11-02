'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { JudgingResults } from '@/types/judging';

export default function JudgingNotesView({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [results, setResults] = useState<JudgingResults | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackId, setTrackId] = useState('all');
  const [judgeId, setJudgeId] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/judging/results`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      setResults((await response.json()) as JudgingResults);
      setError('');
    } catch {
      setError('Unable to load judge notes.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const projects = useMemo(
    () =>
      [...(results?.overall ?? [])]
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(row => ({
          ...row,
          reviews: row.reviews.filter(review => review.comment?.trim()),
        }))
        .filter(row => row.reviews.length > 0),
    [results]
  );

  const judges = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of projects)
      for (const review of row.reviews)
        names.set(review.judgeId, review.judgeName);
    return [...names].sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const query = search.trim().toLowerCase();
  const visible = projects
    .filter(row => trackId === 'all' || row.trackId === trackId)
    .map(row => ({
      ...row,
      reviews: row.reviews.filter(
        review =>
          (judgeId === 'all' || review.judgeId === judgeId) &&
          (!query ||
            review.comment!.toLowerCase().includes(query) ||
            review.judgeName.toLowerCase().includes(query) ||
            row.title.toLowerCase().includes(query))
      ),
    }))
    .filter(row => row.reviews.length > 0);
  const noteCount = visible.reduce((sum, row) => sum + row.reviews.length, 0);

  return (
    <ManagementSection
      title="Judge notes"
      description="Notes judges left while reviewing projects, including reviews that are still in progress. Notes are private to organizers."
      actions={
        <>
          <input
            aria-label="Search notes"
            className={classes.input}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search notes"
            type="search"
            value={search}
          />
          {results && results.tracks.length > 1 && (
            <select
              aria-label="Track"
              className={classes.input}
              onChange={event => setTrackId(event.target.value)}
              value={trackId}
            >
              <option value="all">All tracks</option>
              {results.tracks.map(track => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Judge"
            className={classes.input}
            onChange={event => setJudgeId(event.target.value)}
            value={judgeId}
          >
            <option value="all">All judges</option>
            {judges.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button
            className={classes.secondaryButton}
            disabled={loading}
            onClick={load}
            type="button"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </>
      }
    >
      {error && (
        <ManagementAlert tone="danger">
          <span role="alert">{error}</span>
        </ManagementAlert>
      )}
      {results &&
        (visible.length === 0 ? (
          <ManagementEmptyState>
            {projects.length === 0
              ? 'No judge notes yet.'
              : 'No notes match these filters.'}
          </ManagementEmptyState>
        ) : (
          <div className="grid gap-4">
            <p className={`text-sm ${classes.mutedText}`} role="status">
              {noteCount} {noteCount === 1 ? 'note' : 'notes'} across{' '}
              {visible.length} {visible.length === 1 ? 'project' : 'projects'}
            </p>
            {visible.map(row => (
              <article className="grid gap-2" key={row.submissionId}>
                <h3 className="font-semibold">
                  <Link
                    className="underline-offset-2 hover:underline"
                    href={`/projects/${row.projectId}`}
                    target="_blank"
                  >
                    {row.title}
                  </Link>
                  {results.tracks.length > 1 && (
                    <span
                      className={`ml-2 text-xs font-normal ${classes.mutedText}`}
                    >
                      {row.trackName}
                    </span>
                  )}
                </h3>
                {row.reviews.map(review => (
                  <div
                    className={`${classes.subtlePanel} p-3`}
                    key={review.judgeId}
                  >
                    <p className={`text-xs font-semibold ${classes.mutedText}`}>
                      {review.judgeName}
                      {review.score === null
                        ? ' · Review in progress'
                        : ` · ${review.score.toFixed(2)}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        ))}
    </ManagementSection>
  );
}
