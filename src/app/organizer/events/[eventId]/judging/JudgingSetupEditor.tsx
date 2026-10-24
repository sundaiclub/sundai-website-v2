'use client';

import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import {
  formatDateTimeLocalValue,
  serializeDateTimeLocalValue,
} from '@/lib/datetimeLocal';
import type {
  EventJudgingConfig,
  JudgingConfigInput,
  JudgingCriterionConfig,
  JudgingQuestion,
} from '@/types/judging';
import { JUDGING_SCORE_MAX, JUDGING_SCORE_MIN } from '@/types/judging';

type DraftCriterion = {
  key: string;
  id?: string;
  name: string;
  description: string;
  weight: string;
};

type DraftTrack = {
  key: string;
  id?: string;
  name: string;
  description: string;
  questions: JudgingQuestion[];
  criteria: DraftCriterion[];
  submissionCount: number;
};

type Draft = {
  judgingEnabled: boolean;
  projectsHidden: boolean;
  judgingOpen: boolean;
  judgesPerProject: string;
  opensAt: string;
  closesAt: string;
  criteria: DraftCriterion[];
  tracks: DraftTrack[];
};

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function draftCriterion(criterion: JudgingCriterionConfig): DraftCriterion {
  return {
    key: criterion.id,
    id: criterion.id,
    name: criterion.name,
    description: criterion.description ?? '',
    weight: String(criterion.weight),
  };
}

/** The event window, as datetime-local values, used when no override is saved. */
function defaultWindow(config: EventJudgingConfig) {
  return {
    opensAt: formatDateTimeLocalValue(config.eventStartTime, config.timezone),
    closesAt: formatDateTimeLocalValue(config.eventEndTime, config.timezone),
  };
}

function draftFromConfig(config: EventJudgingConfig): Draft {
  const defaults = defaultWindow(config);
  return {
    judgingEnabled: config.judgingEnabled,
    projectsHidden: config.projectsHidden,
    judgingOpen: config.judgingOpen,
    judgesPerProject: String(config.judgesPerProject),
    opensAt: config.judgingSubmissionsOpenAt
      ? formatDateTimeLocalValue(
          config.judgingSubmissionsOpenAt,
          config.timezone
        )
      : defaults.opensAt,
    closesAt: config.judgingSubmissionsCloseAt
      ? formatDateTimeLocalValue(
          config.judgingSubmissionsCloseAt,
          config.timezone
        )
      : defaults.closesAt,
    criteria: config.criteria.map(draftCriterion),
    tracks: config.tracks.map(track => ({
      key: track.id,
      id: track.id,
      name: track.name,
      description: track.description ?? '',
      questions: track.questions,
      criteria: track.criteria.map(draftCriterion),
      submissionCount: track.submissionCount,
    })),
  };
}

function criteriaInput(criteria: DraftCriterion[]) {
  return criteria.map(criterion => ({
    id: criterion.id,
    name: criterion.name,
    description: criterion.description || null,
    weight: Number(criterion.weight),
  }));
}

/** Times matching the event window are saved as "no override" so they follow event edits. */
function windowOverride(value: string, defaultValue: string) {
  return value === defaultValue ? null : serializeDateTimeLocalValue(value);
}

function inputFromDraft(
  draft: Draft,
  defaults: ReturnType<typeof defaultWindow>
): JudgingConfigInput {
  return {
    judgingEnabled: draft.judgingEnabled,
    projectsHidden: draft.projectsHidden,
    judgingOpen: draft.judgingOpen,
    judgesPerProject: Number(draft.judgesPerProject),
    judgingSubmissionsOpenAt: windowOverride(draft.opensAt, defaults.opensAt),
    judgingSubmissionsCloseAt: windowOverride(
      draft.closesAt,
      defaults.closesAt
    ),
    criteria: criteriaInput(draft.criteria),
    tracks: draft.tracks.map(track => ({
      id: track.id,
      name: track.name,
      description: track.description || null,
      questions: track.questions,
      criteria: criteriaInput(track.criteria),
    })),
  };
}

function formatWindowTime(value: string | null, timezone: string) {
  if (!value) return 'no end';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  });
}

function CriteriaEditor({
  criteria,
  onChange,
  label,
}: {
  criteria: DraftCriterion[];
  onChange: (criteria: DraftCriterion[]) => void;
  label: string;
}) {
  const classes = useManagementClasses();
  const update = (key: string, patch: Partial<DraftCriterion>) =>
    onChange(
      criteria.map(criterion =>
        criterion.key === key ? { ...criterion, ...patch } : criterion
      )
    );

  return (
    <div className="grid gap-2">
      {criteria.map(criterion => (
        <div
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_6rem_auto]"
          key={criterion.key}
        >
          <input
            aria-label={`${label} criterion name`}
            className={classes.input}
            onChange={event =>
              update(criterion.key, { name: event.target.value })
            }
            placeholder="Criterion, e.g. Creativity"
            value={criterion.name}
          />
          <input
            aria-label={`${label} criterion description`}
            className={classes.input}
            onChange={event =>
              update(criterion.key, { description: event.target.value })
            }
            placeholder="What judges should look for (optional)"
            value={criterion.description}
          />
          <input
            aria-label={`${label} criterion weight`}
            className={classes.input}
            min="0.1"
            onChange={event =>
              update(criterion.key, { weight: event.target.value })
            }
            step="0.1"
            title="Weight"
            type="number"
            value={criterion.weight}
          />
          <button
            aria-label={`Remove criterion ${criterion.name || ''}`.trim()}
            className={classes.ghostButton}
            onClick={() =>
              onChange(criteria.filter(item => item.key !== criterion.key))
            }
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
      <div>
        <button
          className={classes.secondaryButton}
          onClick={() =>
            onChange([
              ...criteria,
              { key: newKey(), name: '', description: '', weight: '1' },
            ])
          }
          type="button"
        >
          Add criterion
        </button>
      </div>
    </div>
  );
}

function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: JudgingQuestion[];
  onChange: (questions: JudgingQuestion[]) => void;
}) {
  const classes = useManagementClasses();
  const update = (id: string, patch: Partial<JudgingQuestion>) =>
    onChange(
      questions.map(question =>
        question.id === id ? { ...question, ...patch } : question
      )
    );
  const move = (index: number, offset: number) => {
    const next = [...questions];
    const [question] = next.splice(index, 1);
    next.splice(index + offset, 0, question);
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      {questions.map((question, index) => (
        <div
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          key={question.id}
        >
          <input
            aria-label={`Question ${index + 1}`}
            className={classes.input}
            onChange={event =>
              update(question.id, { prompt: event.target.value })
            }
            placeholder="Question, e.g. What problem does your project solve?"
            value={question.prompt}
          />
          <div className="flex flex-wrap items-center gap-1">
            <label className="flex items-center gap-2 px-2 text-sm">
              <input
                checked={question.required}
                className={classes.checkbox}
                onChange={event =>
                  update(question.id, { required: event.target.checked })
                }
                type="checkbox"
              />
              Required
            </label>
            <button
              aria-label={`Move question ${index + 1} up`}
              className={`${classes.ghostButton} disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              title="Move this question up"
              type="button"
            >
              <ArrowUpIcon aria-hidden="true" className="h-4 w-4" />
              Up
            </button>
            <button
              aria-label={`Move question ${index + 1} down`}
              className={`${classes.ghostButton} disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={index === questions.length - 1}
              onClick={() => move(index, 1)}
              title="Move this question down"
              type="button"
            >
              <ArrowDownIcon aria-hidden="true" className="h-4 w-4" />
              Down
            </button>
            <button
              aria-label={`Remove question ${index + 1}`}
              className={classes.ghostButton}
              onClick={() =>
                onChange(questions.filter(item => item.id !== question.id))
              }
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <p className={`text-xs ${classes.mutedText}`}>
        An optional &quot;Additional info&quot; field is always added after
        these questions.
      </p>
      <div>
        <button
          className={classes.secondaryButton}
          onClick={() =>
            onChange([
              ...questions,
              { id: newKey(), prompt: '', required: true },
            ])
          }
          type="button"
        >
          Add question
        </button>
      </div>
    </div>
  );
}

export default function JudgingSetupEditor({
  eventId,
  config,
  onSaved,
}: {
  eventId: string;
  config: EventJudgingConfig;
  onSaved: (config: EventJudgingConfig) => void;
}) {
  const classes = useManagementClasses();
  const [draft, setDraft] = useState(() => draftFromConfig(config));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const updateTrack = (key: string, patch: Partial<DraftTrack>) =>
    setDraft(current => ({
      ...current,
      tracks: current.tracks.map(track =>
        track.key === key ? { ...track, ...patch } : track
      ),
    }));

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const input = inputFromDraft(draft, defaultWindow(config));
      if (config.judgingAssignmentsPublishedAt) {
        // Disabled date controls must retain the stored instants, including seconds.
        input.judgingSubmissionsOpenAt = config.judgingSubmissionsOpenAt;
        input.judgingSubmissionsCloseAt = config.judgingSubmissionsCloseAt;
      }
      const response = await fetch(`/api/events/${eventId}/judging`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          tone: 'danger',
          text: body?.message ?? 'Unable to save judging setup.',
        });
        return;
      }
      const saved = body as EventJudgingConfig;
      setDraft(draftFromConfig(saved));
      onSaved(saved);
      setNotice({ tone: 'success', text: 'Judging setup saved.' });
    } catch {
      setNotice({ tone: 'danger', text: 'Unable to save judging setup.' });
    } finally {
      setSaving(false);
    }
  }

  const saveButton = (
    <button
      className={classes.primaryButton}
      disabled={saving}
      onClick={save}
      type="button"
    >
      {saving ? 'Saving…' : 'Save judging setup'}
    </button>
  );

  return (
    <div className="grid gap-5">
      <ManagementSection
        title="Judging settings"
        description="When judging is enabled, projects submitted to this event answer track questions instead of writing a description."
        actions={saveButton}
      >
        <div className="grid gap-4">
          <label className="flex items-start gap-3">
            <input
              checked={draft.judgingEnabled}
              className={`${classes.checkbox} mt-1`}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  judgingEnabled: event.target.checked,
                  projectsHidden: event.target.checked
                    ? true
                    : current.projectsHidden,
                }))
              }
              type="checkbox"
            />
            <span>
              <span className="font-semibold">Enable judging</span>
              <span className={`block text-sm ${classes.mutedText}`}>
                Participants choose a track and answer its questions.
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 ${
              draft.judgingEnabled ? '' : 'cursor-not-allowed opacity-50'
            }`}
          >
            <input
              checked={draft.judgingOpen}
              className={`${classes.checkbox} mt-1`}
              disabled={!draft.judgingEnabled}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  judgingOpen: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>
              <span className="font-semibold">Open scoring</span>
              <span className={`block text-sm ${classes.mutedText}`}>
                {draft.judgingEnabled
                  ? config.judgingAssignmentsPublishedAt
                    ? 'Judges can submit and change scores. Closing scoring ends judging and unlocks project edits. Reopening scoring locks edits again and keeps the same assignments.'
                    : 'After submissions close and all judges are added, select this and save to publish assignments and open scoring. Submitted projects are locked until scoring is closed after judging. Check Assignments for coverage first.'
                  : 'Enable judging to open scoring for judges.'}
              </span>
            </span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Judges per project</span>
            <input
              className={`${classes.input} max-w-32`}
              type="number"
              min="1"
              step="1"
              disabled={Boolean(config.judgingAssignmentsPublishedAt)}
              value={draft.judgesPerProject}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  judgesPerProject: event.target.value,
                }))
              }
            />
            <span className={classes.mutedText}>
              Applies to every track. Full project coverage takes priority over
              equal judge workloads.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              checked={draft.projectsHidden}
              className={`${classes.checkbox} mt-1`}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  projectsHidden: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>
              <span className="font-semibold">Hide event projects</span>
              <span className={`block text-sm ${classes.mutedText}`}>
                Team members can view and edit their projects. Judges and
                organizers keep access through their event tools. Turn this off
                to show projects to everyone, then save the judging setup.
              </span>
            </span>
          </label>
          <fieldset
            className="grid gap-2"
            disabled={Boolean(config.judgingAssignmentsPublishedAt)}
          >
            <legend className="font-semibold">Project submission window</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-sm ${classes.mutedText}`}>
                Defaults to the event window (
                {formatWindowTime(config.eventStartTime, config.timezone)} –{' '}
                {formatWindowTime(config.eventEndTime, config.timezone)}). Times
                are in {config.timezone}.
              </p>
              <button
                className={`${classes.ghostButton} disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={
                  draft.opensAt === defaultWindow(config).opensAt &&
                  draft.closesAt === defaultWindow(config).closesAt
                }
                onClick={() =>
                  setDraft(current => ({
                    ...current,
                    ...defaultWindow(config),
                  }))
                }
                type="button"
              >
                Reset to event window
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Opens
                <input
                  className={classes.input}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      opensAt: event.target.value,
                    }))
                  }
                  type="datetime-local"
                  value={draft.opensAt}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Closes
                <input
                  className={classes.input}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      closesAt: event.target.value,
                    }))
                  }
                  type="datetime-local"
                  value={draft.closesAt}
                />
              </label>
            </div>
          </fieldset>
        </div>
      </ManagementSection>

      {config.judgingAssignmentsPublishedAt && (
        <ManagementAlert>
          Assignments, tracks, criteria, and submission dates are fixed because
          scoring has started.
        </ManagementAlert>
      )}
      <fieldset
        className="grid min-w-0 gap-5"
        disabled={Boolean(config.judgingAssignmentsPublishedAt)}
      >
        <ManagementSection
          title="Event criteria"
          description={`Every project is scored on these criteria from ${JUDGING_SCORE_MIN} to ${JUDGING_SCORE_MAX}. Weights control how much each criterion counts toward the total.`}
        >
          <CriteriaEditor
            criteria={draft.criteria}
            label="Event"
            onChange={criteria =>
              setDraft(current => ({ ...current, criteria }))
            }
          />
        </ManagementSection>

        <ManagementSection
          title="Tracks"
          description="Each track has its own submission questions and can add criteria on top of the event criteria."
          actions={
            <button
              className={classes.secondaryButton}
              onClick={() =>
                setDraft(current => ({
                  ...current,
                  tracks: [
                    ...current.tracks,
                    {
                      key: newKey(),
                      name: '',
                      description: '',
                      questions: [],
                      criteria: [],
                      submissionCount: 0,
                    },
                  ],
                }))
              }
              type="button"
            >
              Add track
            </button>
          }
        >
          <div className="grid gap-4">
            {draft.tracks.length === 0 && (
              <ManagementEmptyState>
                Add a track before enabling judging.
              </ManagementEmptyState>
            )}
            {draft.tracks.map((track, index) => (
              <div
                className={`${classes.subtlePanel} grid gap-4 p-4`}
                key={track.key}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">Track {index + 1}</h3>
                    <ManagementBadge>
                      {track.submissionCount}{' '}
                      {track.submissionCount === 1
                        ? 'submission'
                        : 'submissions'}
                    </ManagementBadge>
                  </div>
                  <button
                    className={classes.ghostButton}
                    disabled={track.submissionCount > 0}
                    onClick={() =>
                      setDraft(current => ({
                        ...current,
                        tracks: current.tracks.filter(
                          item => item.key !== track.key
                        ),
                      }))
                    }
                    title={
                      track.submissionCount > 0
                        ? 'Tracks with submissions cannot be deleted'
                        : undefined
                    }
                    type="button"
                  >
                    Delete track
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <label className="grid gap-1 text-sm">
                    Name
                    <input
                      className={classes.input}
                      onChange={event =>
                        updateTrack(track.key, { name: event.target.value })
                      }
                      placeholder="e.g. AI for Good"
                      value={track.name}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Description
                    <input
                      className={classes.input}
                      onChange={event =>
                        updateTrack(track.key, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Shown to participants choosing a track (optional)"
                      value={track.description}
                    />
                  </label>
                </div>
                <div className="grid gap-2">
                  <h4 className="text-sm font-semibold">
                    Submission questions
                  </h4>
                  <QuestionsEditor
                    questions={track.questions}
                    onChange={questions =>
                      updateTrack(track.key, { questions })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <h4 className="text-sm font-semibold">Track criteria</h4>
                  <p className={`text-xs ${classes.mutedText}`}>
                    Scored in addition to the event criteria for projects in
                    this track.
                  </p>
                  <CriteriaEditor
                    criteria={track.criteria}
                    label={track.name || `Track ${index + 1}`}
                    onChange={criteria => updateTrack(track.key, { criteria })}
                  />
                </div>
              </div>
            ))}
          </div>
        </ManagementSection>
      </fieldset>
      {notice && (
        <ManagementAlert tone={notice.tone}>
          <span role="status">{notice.text}</span>
        </ManagementAlert>
      )}
      <div className="flex justify-end">{saveButton}</div>
    </div>
  );
}
