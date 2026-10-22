'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type {
  JudgingCriterionConfig,
  JudgingLeaderboardRow,
  JudgingResults,
} from '@/types/judging';

function formatScore(value: number | null) {
  return value === null ? '—' : value.toFixed(2);
}

function Leaderboard({
  rows,
  criteria,
  criterionNames,
  showTrack,
}: {
  rows: JudgingLeaderboardRow[];
  criteria: JudgingCriterionConfig[];
  criterionNames: Map<string, string>;
  showTrack: boolean;
}) {
  const classes = useManagementClasses();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <ManagementEmptyState>No submitted projects yet.</ManagementEmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className={classes.mutedText}>
          <tr>
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Project</th>
            {showTrack && <th className="px-2 py-2">Track</th>}
            <th
              className="px-2 py-2"
              title="Adjusted for each judge's scoring tendencies"
            >
              Normalized
            </th>
            <th className="px-2 py-2">Raw avg</th>
            <th className="px-2 py-2">Reviews complete / required</th>
            <th className="px-2 py-2">Judges assigned</th>
            {criteria.map(criterion => (
              <th className="px-2 py-2" key={criterion.id}>
                {criterion.name}
              </th>
            ))}
            <th className="px-2 py-2">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y ${classes.divider}`}>
          {rows.map((row, index) => (
            <Fragment key={row.submissionId}>
              <tr>
                <td className="px-2 py-2 font-bold">{index + 1}</td>
                <td className="px-2 py-2">
                  <Link
                    className="font-semibold underline-offset-2 hover:underline"
                    href={`/projects/${row.projectId}`}
                    target="_blank"
                  >
                    {row.title}
                  </Link>
                </td>
                {showTrack && <td className="px-2 py-2">{row.trackName}</td>}
                <td className="px-2 py-2 font-bold">
                  {formatScore(row.normalizedScore)}
                </td>
                <td className="px-2 py-2">{formatScore(row.rawScore)}</td>
                <td className="px-2 py-2">
                  {row.judgeCount}/{row.requiredJudgeCount}
                </td>
                <td className="px-2 py-2">{row.assignedJudgeCount}</td>
                {criteria.map(criterion => (
                  <td className="px-2 py-2" key={criterion.id}>
                    {formatScore(row.criterionAverages[criterion.id] ?? null)}
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <button
                    aria-expanded={expanded === row.submissionId}
                    className={classes.ghostButton}
                    disabled={row.reviews.length === 0}
                    onClick={() =>
                      setExpanded(current =>
                        current === row.submissionId ? null : row.submissionId
                      )
                    }
                    type="button"
                  >
                    {expanded === row.submissionId ? 'Hide' : 'Scores'}
                  </button>
                </td>
              </tr>
              {expanded === row.submissionId && (
                <tr>
                  <td
                    className="px-2 pb-4"
                    colSpan={7 + criteria.length + (showTrack ? 1 : 0)}
                  >
                    <div className="grid gap-2">
                      {row.reviews.map(review => (
                        <div
                          className={`${classes.subtlePanel} p-3`}
                          key={review.judgeId}
                        >
                          <p className="font-semibold">
                            {review.judgeName} · {formatScore(review.score)}
                          </p>
                          <p className={`text-xs ${classes.mutedText}`}>
                            {Object.entries(review.scores)
                              .map(
                                ([criterionId, score]) =>
                                  `${criterionNames.get(criterionId) ?? 'Criterion'}: ${score}`
                              )
                              .join(' · ') || 'No scores yet'}
                          </p>
                          {review.comment && (
                            <p className="mt-2 whitespace-pre-wrap text-sm">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function JudgingResultsView({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [results, setResults] = useState<JudgingResults | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('overall');
  const [loading, setLoading] = useState(false);

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
      setError('Unable to load judging results.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const track = results?.tracks.find(item => item.id === view);
  const criterionNames = new Map(
    results?.tracks.flatMap(item =>
      item.criteria.map(criterion => [criterion.id, criterion.name] as const)
    ) ?? []
  );

  return (
    <ManagementSection
      title="Leaderboard"
      description="Scores are private to organizers. Only complete reviews count toward scores and coverage. Normalized scores adjust for each judge's scoring pattern; small review sets can affect this adjustment. Raw averages are shown for reference."
      actions={
        <>
          <select
            aria-label="Leaderboard"
            className={classes.input}
            onChange={event => setView(event.target.value)}
            value={view}
          >
            <option value="overall">Overall</option>
            {results?.tracks.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
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
        (track ? (
          <Leaderboard
            criteria={track.criteria}
            criterionNames={criterionNames}
            rows={track.rows}
            showTrack={false}
          />
        ) : (
          <Leaderboard
            criteria={[]}
            criterionNames={criterionNames}
            rows={results.overall}
            showTrack
          />
        ))}
    </ManagementSection>
  );
}
