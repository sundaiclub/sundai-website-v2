'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  useManagementClasses,
} from './ManagementSurface';
import ProjectMarkdown from './ProjectMarkdown';
import { isJudgingReviewComplete } from '@/lib/judging';
import {
  JUDGE_TOKEN_HEADER,
  JUDGE_TOKEN_PARAM,
  type JudgePanelPayload,
  type JudgeProjectView,
} from '@/types/judging';

/** Magic-link judges authenticate each request with the token from their invite URL. */
function judgeHeaders(token: string | null): Record<string, string> {
  return token ? { [JUDGE_TOKEN_HEADER]: token } : {};
}

type Draft = { scores: Record<string, number>; comment: string };

function draftFor(project: JudgeProjectView | undefined): Draft {
  return {
    scores: { ...(project?.review?.scores ?? {}) },
    comment: project?.review?.comment ?? '',
  };
}

function sameDraft(a: Draft, b: Draft) {
  const keys = new Set([...Object.keys(a.scores), ...Object.keys(b.scores)]);
  return (
    a.comment.trim() === b.comment.trim() &&
    Array.from(keys).every(key => a.scores[key] === b.scores[key])
  );
}

export default function EventJudgingPanel({
  eventId,
  judgeToken,
}: {
  eventId: string;
  judgeToken: string | null;
}) {
  const classes = useManagementClasses();
  const [panel, setPanel] = useState<JudgePanelPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [trackId, setTrackId] = useState('');
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({ scores: {}, comment: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/judging/${eventId}`, {
          cache: 'no-store',
          headers: judgeHeaders(judgeToken),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.message || 'Unable to load judging.');
        if (!current) return;
        const payload = body as JudgePanelPayload;
        setPanel(payload);
        setTrackId(
          payload.tracks.find(track => track.projects.length > 0)?.id ??
            payload.tracks[0]?.id ??
            ''
        );
        setLoadError('');
        if (!payload.assignmentsPublished) timer = setTimeout(load, 15000);
      } catch (error) {
        if (!current) return;
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load judging.'
        );
        timer = setTimeout(load, 15000);
      }
    }
    load();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [eventId, judgeToken]);

  const track = panel?.tracks.find(item => item.id === trackId);
  const projects = useMemo(() => track?.projects ?? [], [track]);
  const project = projects[index];

  useEffect(() => {
    setDraft(draftFor(project));
  }, [project]);

  const isComplete = useCallback(
    (item: JudgeProjectView) =>
      isJudgingReviewComplete(track?.criteria ?? [], item.review?.scores ?? {}),
    [track]
  );
  const completedCount = projects.filter(isComplete).length;
  const dirty = project ? !sameDraft(draft, draftFor(project)) : false;
  const canScore = Boolean(panel?.judgingOpen);

  async function save(): Promise<boolean> {
    if (!project || !panel) return false;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/judging/${eventId}/reviews/${project.submissionId}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            ...judgeHeaders(judgeToken),
          },
          body: JSON.stringify(draft),
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          tone: 'danger',
          text: body?.message ?? 'Unable to save scores.',
        });
        return false;
      }
      setPanel(current =>
        current
          ? {
              ...current,
              tracks: current.tracks.map(item => ({
                ...item,
                projects: item.projects.map(entry =>
                  entry.submissionId === project.submissionId
                    ? { ...entry, review: body }
                    : entry
                ),
              })),
            }
          : current
      );
      setNotice({
        tone: 'success',
        text: `Saved scores for ${project.title}.`,
      });
      return true;
    } catch {
      setNotice({ tone: 'danger', text: 'Unable to save scores.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Saves pending changes before moving, so judges never lose scores. */
  async function goTo(nextIndex: number) {
    if (canScore && dirty && !(await save())) return;
    setIndex(nextIndex);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function changeTrack(nextTrackId: string) {
    if (canScore && dirty && !(await save())) return;
    setTrackId(nextTrackId);
    setIndex(0);
    setNotice(null);
  }

  const otherTracks = panel?.tracks.filter(item => item.id !== trackId) ?? [];
  const trackScoredCount = (item: JudgePanelPayload['tracks'][number]) =>
    item.projects.filter(entry =>
      isJudgingReviewComplete(item.criteria, entry.review?.scores ?? {})
    ).length;
  const isLastProject = index === projects.length - 1;
  const hasUnsavedScores = canScore && dirty;
  const projectNav = project ? (
    <nav
      aria-label="Project navigation"
      className={`${classes.panel} flex items-center justify-between gap-3 p-3`}
    >
      <button
        className={classes.secondaryButton}
        disabled={saving || index === 0}
        onClick={() => goTo(index - 1)}
        type="button"
      >
        ←<span className="hidden sm:inline">Previous project</span>
        <span className="sm:hidden">Prev</span>
      </button>
      <p className="shrink-0 text-center text-sm">
        <span className="font-semibold">
          Project {index + 1} of {projects.length}
        </span>
        <span className={`block text-xs ${classes.mutedText}`}>
          {isComplete(project)
            ? '✓ Scored'
            : project.review
              ? 'Partly scored'
              : 'Not scored yet'}
        </span>
      </p>
      <button
        className={classes.primaryButton}
        disabled={saving || (isLastProject && !hasUnsavedScores)}
        onClick={() => (isLastProject ? save() : goTo(index + 1))}
        type="button"
      >
        {hasUnsavedScores ? (
          isLastProject ? (
            'Save scores'
          ) : (
            'Save & next →'
          )
        ) : (
          <>
            <span className="hidden sm:inline">Next project</span>
            <span className="sm:hidden">Next</span>→
          </>
        )}
      </button>
    </nav>
  ) : null;

  if (loadError) {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">{loadError}</span>
      </ManagementAlert>
    );
  }
  if (!panel) {
    return (
      <ManagementAlert>
        <span role="status">Loading judging…</span>
      </ManagementAlert>
    );
  }

  if (!panel.assignmentsPublished) {
    return (
      <ManagementAlert>
        <span role="status">
          Judging has not started. Your assigned projects will appear when the
          organizer opens scoring.
        </span>
      </ManagementAlert>
    );
  }

  return (
    <div className="grid gap-5">
      <section className={`${classes.panel} grid gap-3 p-4 sm:p-5`}>
        {track ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">
              You are now judging {track.name}
            </h2>
            <ManagementBadge
              tone={
                completedCount === projects.length && projects.length > 0
                  ? 'success'
                  : 'default'
              }
            >
              {completedCount} of {projects.length} scored
            </ManagementBadge>
          </div>
        ) : (
          <h2 className="text-xl font-bold sm:text-2xl">Judging</h2>
        )}
        <p className={`text-sm ${classes.mutedText}`}>
          {panel.tracks.reduce(
            (count, item) => count + trackScoredCount(item),
            0
          )}{' '}
          of{' '}
          {panel.tracks.reduce(
            (count, item) => count + item.projects.length,
            0
          )}{' '}
          assigned projects complete across all tracks. Complete every scoring
          criterion for a review to count as complete.
        </p>
        <p className={`text-sm ${classes.mutedText}`}>
          Judging as {panel.judge.name || panel.judge.email}. Scores go from{' '}
          {panel.scoreMin} to {panel.scoreMax}, are only visible to organizers,
          and can be changed while judging is open.
        </p>
        {!panel.judgingOpen && (
          <ManagementAlert tone="warning">
            <span role="status">
              Judging is closed. Your scores are locked.
            </span>
          </ManagementAlert>
        )}
        {otherTracks.length > 0 && (
          <div
            className={`grid gap-2 border-t pt-3 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
          >
            <p className="text-sm font-semibold">
              {otherTracks.length === 1
                ? 'You have another track to judge, which you can do here:'
                : `You have ${otherTracks.length} other tracks to judge, which you can do here:`}
            </p>
            <div className="flex flex-wrap gap-2">
              {panel.tracks.map(item => {
                const isCurrent = item.id === trackId;
                return (
                  <button
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`${
                      isCurrent
                        ? `${classes.primaryButton} disabled:!cursor-default disabled:!opacity-100`
                        : classes.secondaryButton
                    }`}
                    disabled={saving || isCurrent}
                    key={item.id}
                    onClick={() => changeTrack(item.id)}
                    type="button"
                  >
                    {isCurrent ? 'Judging' : 'Judge'} {item.name}
                    <span
                      className={`text-xs font-normal ${isCurrent ? 'opacity-70' : classes.mutedText}`}
                    >
                      {trackScoredCount(item)}/{item.projects.length} scored
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {panel.tracks.length === 0 && (
        <ManagementEmptyState>
          You haven&apos;t been assigned any tracks yet.
        </ManagementEmptyState>
      )}
      {track && projects.length === 0 && (
        <ManagementEmptyState>
          You have no assigned projects in {track.name}.
        </ManagementEmptyState>
      )}

      {track && project && (
        <>
          {projectNav}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="grid min-w-0 gap-4">
              <article
                className={`${classes.panel} flex items-start gap-3 p-4 sm:gap-4`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${project.title} thumbnail`}
                  className="aspect-[3/2] w-24 shrink-0 rounded-md bg-black object-cover sm:w-44"
                  src={
                    project.thumbnailUrl ??
                    (classes.isDarkMode
                      ? '/images/default_project_thumbnail_dark.svg'
                      : '/images/default_project_thumbnail_light.svg')
                  }
                />
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <h2 className="text-lg font-bold">{project.title}</h2>
                    {project.team.length > 0 && (
                      <p
                        className={`text-sm sm:text-right ${classes.mutedText}`}
                      >
                        <span className="sr-only">Team: </span>
                        {project.team.join(', ')}
                      </p>
                    )}
                  </div>
                  {project.preview && (
                    <ProjectMarkdown
                      className={`prose prose-sm max-w-none ${classes.isDarkMode ? 'prose-invert' : ''}`}
                      markdown={project.preview}
                    />
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                    {[
                      ['GitHub', project.githubUrl],
                      ['Demo', project.demoUrl],
                      ['Blog', project.blogUrl],
                      [
                        'Project page',
                        `/projects/${project.projectId}?event=${encodeURIComponent(eventId)}${judgeToken ? `&${JUDGE_TOKEN_PARAM}=${encodeURIComponent(judgeToken)}` : ''}`,
                      ],
                    ].map(([label, href]) =>
                      href ? (
                        <a
                          className="underline-offset-2 hover:underline"
                          href={href}
                          key={label}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {label} ↗
                        </a>
                      ) : null
                    )}
                  </div>
                </div>
              </article>

              {project.answers.length > 0 && (
                <ol aria-label="Submission answers" className="grid gap-3">
                  {project.answers.map((answer, answerIndex) => (
                    <li
                      className={`${classes.panel} p-4 sm:p-5`}
                      key={answer.prompt}
                    >
                      {answer.prompt !== 'Additional info' && (
                        <p
                          className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
                        >
                          Question {answerIndex + 1}
                        </p>
                      )}
                      <h3 className="mt-1 font-bold">{answer.prompt}</h3>
                      <div
                        className={`mt-3 border-t pt-3 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
                      >
                        <ProjectMarkdown
                          className={`prose prose-sm max-w-none ${classes.isDarkMode ? 'prose-invert' : ''}`}
                          markdown={answer.answer}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <aside
              aria-label="Your scores"
              className={`${classes.panel} grid gap-4 p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
            >
              <h2 className="text-lg font-bold">Your scores</h2>
              {track.criteria.length === 0 && (
                <ManagementEmptyState>
                  The organizers haven&apos;t added judging criteria yet.
                </ManagementEmptyState>
              )}
              {track.criteria.map(criterion => (
                <fieldset className="grid gap-2" key={criterion.id}>
                  <legend className="text-base font-semibold">
                    {criterion.name}
                    {criterion.description && (
                      <span
                        className={`mt-0.5 block text-sm font-normal ${classes.mutedText}`}
                      >
                        {criterion.description}
                      </span>
                    )}
                  </legend>
                  <div className="grid grid-cols-5 gap-1">
                    {Array.from(
                      { length: panel.scoreMax - panel.scoreMin + 1 },
                      (_, offset) => panel.scoreMin + offset
                    ).map(score => {
                      const selected = draft.scores[criterion.id] === score;
                      return (
                        <button
                          aria-label={`${criterion.name}: ${score}`}
                          aria-pressed={selected}
                          className={`h-10 rounded-md border text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            selected
                              ? classes.isDarkMode
                                ? 'border-gray-100 bg-gray-100 text-gray-900'
                                : 'border-gray-900 bg-gray-900 text-white'
                              : classes.isDarkMode
                                ? 'border-gray-700 hover:bg-gray-800'
                                : 'border-gray-300 hover:bg-gray-100'
                          }`}
                          disabled={!canScore}
                          key={score}
                          onClick={() =>
                            setDraft(current => ({
                              ...current,
                              scores: {
                                ...current.scores,
                                [criterion.id]: score,
                              },
                            }))
                          }
                          type="button"
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <label className="grid gap-1">
                <span className="text-sm font-semibold">
                  Private notes (optional)
                </span>
                <span className={`text-xs ${classes.mutedText}`}>
                  Only organizers can see these.
                </span>
                <textarea
                  className={`${classes.textarea} !min-h-24`}
                  disabled={!canScore}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                  value={draft.comment}
                />
              </label>
              {notice && (
                <ManagementAlert tone={notice.tone}>
                  <span role="status">{notice.text}</span>
                </ManagementAlert>
              )}
              {canScore && (
                <button
                  className={classes.primaryButton}
                  disabled={saving || !dirty}
                  onClick={save}
                  type="button"
                >
                  {saving
                    ? 'Saving…'
                    : !dirty && project.review
                      ? 'Saved'
                      : 'Save scores'}
                </button>
              )}
            </aside>
          </div>
          {projectNav}
        </>
      )}
    </div>
  );
}
