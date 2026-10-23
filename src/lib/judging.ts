import {
  ADDITIONAL_INFO_KEY,
  JUDGING_SCORE_MAX,
  JUDGING_SCORE_MIN,
  type JudgingAnswers,
  type JudgingQuestion,
} from '@/types/judging';

// Pure judging helpers shared by the project form, judge panel, and APIs.

export const MAX_JUDGING_ANSWER_LENGTH = 5000;

export function parseJudgingQuestions(value: unknown): JudgingQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { id, prompt, required } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof prompt !== 'string') return [];
    if (!prompt.trim() || id === ADDITIONAL_INFO_KEY) return [];
    return [{ id, prompt: prompt.trim(), required: required === true }];
  });
}

export function parseJudgingAnswers(value: unknown): JudgingAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

/** Keeps only answers to the track's questions plus additional info. */
export function normalizeJudgingAnswers(
  questions: JudgingQuestion[],
  answers: JudgingAnswers
): JudgingAnswers {
  const keys = [...questions.map(question => question.id), ADDITIONAL_INFO_KEY];
  return Object.fromEntries(
    keys.map(key => [
      key,
      (answers[key] ?? '').trim().slice(0, MAX_JUDGING_ANSWER_LENGTH),
    ])
  );
}

export function missingRequiredJudgingAnswers(
  questions: JudgingQuestion[],
  answers: JudgingAnswers
): JudgingQuestion[] {
  return questions.filter(
    question => question.required && !(answers[question.id] ?? '').trim()
  );
}

/** Answered questions in display order, ending with additional info. */
export function judgingAnswerList(
  questions: JudgingQuestion[],
  answers: JudgingAnswers
): Array<{ prompt: string; answer: string }> {
  return [
    ...questions.map(question => ({
      prompt: question.prompt,
      answer: answers[question.id] ?? '',
    })),
    { prompt: 'Additional info', answer: answers[ADDITIONAL_INFO_KEY] ?? '' },
  ].filter(item => item.answer.trim());
}

/** The project's long description is generated from the judging answers. */
export function composeJudgingDescription(
  questions: JudgingQuestion[],
  answers: JudgingAnswers
): string {
  return judgingAnswerList(questions, answers)
    .map(({ prompt, answer }) => `### ${prompt}\n\n${answer.trim()}`)
    .join('\n\n');
}

export function judgingSubmissionWindow(event: {
  startTime: Date | string;
  endTime: Date | string | null;
  judgingSubmissionsOpenAt: Date | string | null;
  judgingSubmissionsCloseAt: Date | string | null;
}) {
  const opensAt = new Date(event.judgingSubmissionsOpenAt ?? event.startTime);
  const closeValue = event.judgingSubmissionsCloseAt ?? event.endTime;
  return { opensAt, closesAt: closeValue ? new Date(closeValue) : null };
}

export function isJudgingSubmissionWindowOpen(
  event: Parameters<typeof judgingSubmissionWindow>[0],
  now = new Date()
): boolean {
  const { opensAt, closesAt } = judgingSubmissionWindow(event);
  return opensAt <= now && (!closesAt || now <= closesAt);
}

export const PROJECT_JUDGING_LOCK_MESSAGE =
  'This project is locked for judging. You can edit it after judging ends.';

/** Closing scoring after assignments are published concludes judging. */
export function hasJudgingConcluded(event: {
  judgingAssignmentsPublishedAt: Date | string | null;
  judgingOpen: boolean;
}): boolean {
  return Boolean(event.judgingAssignmentsPublishedAt) && !event.judgingOpen;
}

export function isProjectLockedForJudging(
  event: Parameters<typeof judgingSubmissionWindow>[0] &
    Parameters<typeof hasJudgingConcluded>[0] & { judgingEnabled: boolean },
  now = new Date()
): boolean {
  if (!event.judgingEnabled || hasJudgingConcluded(event)) return false;
  const { closesAt } = judgingSubmissionWindow(event);
  return (
    Boolean(event.judgingAssignmentsPublishedAt) ||
    Boolean(closesAt && now > closesAt)
  );
}

export function isValidJudgingScore(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= JUDGING_SCORE_MIN &&
    (value as number) <= JUDGING_SCORE_MAX
  );
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Shuffles projects per judge so every judge sees a different but stable
 * order, which spreads out first-project fatigue across submissions.
 */
export function orderForJudge<T extends { submissionId: string }>(
  judgeId: string,
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      fnv1a(`${judgeId}:${a.submissionId}`) -
        fnv1a(`${judgeId}:${b.submissionId}`) ||
      a.submissionId.localeCompare(b.submissionId)
  );
}

type WeightedCriterion = { id: string; weight: number };

export function isJudgingReviewComplete(
  criteria: Array<{ id: string }>,
  scores: Record<string, number>
): boolean {
  return (
    criteria.length > 0 &&
    criteria.every(criterion => isValidJudgingScore(scores[criterion.id]))
  );
}

/** Weighted mean of the scored criteria, or null when nothing is scored. */
export function weightedReviewScore(
  criteria: WeightedCriterion[],
  scores: Record<string, number>
): number | null {
  let total = 0;
  let weights = 0;
  for (const criterion of criteria) {
    const score = scores[criterion.id];
    if (score === undefined || criterion.weight <= 0) continue;
    total += score * criterion.weight;
    weights += criterion.weight;
  }
  return weights > 0 ? total / weights : null;
}

function meanAndDeviation(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, deviation: Math.sqrt(variance) };
}

export type ScoredReview = {
  judgeId: string;
  submissionId: string;
  score: number;
};

/**
 * Corrects for harsh or lenient judges: each review is converted to a z-score
 * against that judge's own scores, then mapped back onto the pooled score
 * distribution so normalized scores stay on the familiar scale. A judge with
 * no spread (for example a single review) contributes the pooled mean.
 */
export function normalizeReviewScores(
  reviews: ScoredReview[]
): Map<ScoredReview, number> {
  const normalized = new Map<ScoredReview, number>();
  if (reviews.length === 0) return normalized;

  const pooled = meanAndDeviation(reviews.map(review => review.score));
  const byJudge = new Map<string, number[]>();
  for (const review of reviews) {
    byJudge.set(review.judgeId, [
      ...(byJudge.get(review.judgeId) ?? []),
      review.score,
    ]);
  }
  const judgeStats = new Map(
    Array.from(byJudge, ([judgeId, scores]) => [
      judgeId,
      meanAndDeviation(scores),
    ])
  );

  for (const review of reviews) {
    const judge = judgeStats.get(review.judgeId)!;
    const zScore =
      judge.deviation > 0 ? (review.score - judge.mean) / judge.deviation : 0;
    normalized.set(review, pooled.mean + zScore * pooled.deviation);
  }
  return normalized;
}

export function roundScore(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

type SelectableEvent = { id: string; judging: unknown | null };

/**
 * A project has one long description, so it can be judged at only one event.
 * Selecting a judging event clears any other selected judging event.
 */
export function selectProjectEvent(
  current: string[],
  events: SelectableEvent[],
  eventId: string,
  selected: boolean
): string[] {
  if (!selected) return current.filter(id => id !== eventId);
  const isJudged = (id: string) =>
    Boolean(events.find(event => event.id === id)?.judging);
  const kept = isJudged(eventId)
    ? current.filter(id => !isJudged(id))
    : current;
  return Array.from(new Set([...kept, eventId]));
}

/** Applies the one-judging-event rule to a default selection, keeping the first. */
export function limitToOneJudgingEvent(
  ids: string[],
  events: SelectableEvent[]
): string[] {
  let hasJudgedEvent = false;
  return ids.filter(id => {
    if (!events.find(event => event.id === id)?.judging) return true;
    if (hasJudgedEvent) return false;
    hasJudgedEvent = true;
    return true;
  });
}
