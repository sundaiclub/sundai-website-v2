import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { allocateJudgingAssignments } from '@/lib/judgingAssignments';
import {
  EventDateTimeInputError,
  parseOptionalEventDateTimeInput,
} from '@/lib/eventDateTime';
import {
  createJudgeToken,
  isValidJudgeEmail,
  normalizeJudgeEmail,
} from '@/lib/judgingAccess';
import {
  composeJudgingDescription,
  hasJudgingConcluded,
  isJudgingSubmissionWindowOpen,
  isJudgingReviewComplete,
  isValidJudgingScore,
  judgingAnswerList,
  missingRequiredJudgingAnswers,
  normalizeJudgingAnswers,
  normalizeReviewScores,
  orderForJudge,
  parseJudgingAnswers,
  parseJudgingQuestions,
  roundScore,
  weightedReviewScore,
  type ScoredReview,
} from '@/lib/judging';
import {
  JUDGING_SCORE_MAX,
  JUDGING_SCORE_MIN,
  type EventJudgingConfig,
  type JudgePanelPayload,
  type JudgingAnswers,
  type JudgingAssignmentPreview,
  type JudgingConfigInput,
  type JudgingCriterionConfig,
  type JudgingLeaderboardRow,
  type JudgingQuestion,
  type JudgingResults,
  type ProjectJudgingOption,
} from '@/types/judging';

const MAX_TRACKS = 30;
const MAX_CRITERIA = 30;
const MAX_QUESTIONS = 20;
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_PROMPT_LENGTH = 500;
const MAX_COMMENT_LENGTH = 5000;

export class JudgingError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'JudgingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function judgingErrorResponse(error: unknown, tag: string) {
  if (error instanceof JudgingError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status }
    );
  }
  console.error(tag, error);
  return NextResponse.json(
    { message: 'Internal Server Error' },
    { status: 500 }
  );
}

/** Projects judges see: published, still in the event, and not from banned leads. */
export function judgeableSubmissionWhere(
  eventId: string
): Prisma.JudgingSubmissionWhereInput {
  return {
    eventId,
    project: {
      status: 'APPROVED',
      eventParticipations: { some: { eventId } },
      launchLead: { userBans: { none: { revokedAt: null } } },
    },
  };
}

const criterionSelect = {
  id: true,
  trackId: true,
  name: true,
  description: true,
  weight: true,
} satisfies Prisma.JudgingCriterionSelect;

function toCriterion(
  criterion: Prisma.JudgingCriterionGetPayload<{
    select: typeof criterionSelect;
  }>
): JudgingCriterionConfig {
  return { ...criterion };
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

/** Serialize setup, roster changes, submissions, and publication per event. */
async function withJudgingEventLock<T>(
  eventId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      return operation(tx);
    },
    { timeout: 15000 }
  );
}

async function requireDraftAssignments(
  tx: Prisma.TransactionClient,
  eventId: string
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { judgingAssignmentsPublishedAt: true },
  });
  if (!event) throw new JudgingError('Event not found.', 404);
  if (event.judgingAssignmentsPublishedAt) {
    throw new JudgingError(
      'Assignments are fixed because scoring has started.',
      409
    );
  }
}

async function assignmentState(eventId: string, db: Prisma.TransactionClient) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      judgesPerProject: true,
      judgingAssignmentsPublishedAt: true,
      judgingTracks: {
        orderBy: { position: 'asc' },
        select: { id: true, name: true },
      },
      judgingCriteria: { select: { id: true, trackId: true } },
      judges: {
        where: { revokedAt: null },
        orderBy: { invitedAt: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          tracks: { select: { trackId: true } },
        },
      },
      judgingSubmissions: {
        where: judgeableSubmissionWhere(eventId),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          trackId: true,
          project: { select: { title: true } },
          assignments: { select: { judgeId: true } },
          reviews: {
            select: {
              judgeId: true,
              scores: { select: { criterionId: true, score: true } },
            },
          },
        },
      },
    },
  });
  if (!event) throw new JudgingError('Event not found.', 404);
  const published = Boolean(event.judgingAssignmentsPublishedAt);
  const judges = event.judges.map(judge => ({
    id: judge.id,
    trackIds: judge.tracks.map(track => track.trackId),
  }));
  const assignments = published
    ? event.judgingSubmissions.flatMap(project =>
        project.assignments.map(assignment => ({
          judgeId: assignment.judgeId,
          submissionId: project.id,
        }))
      )
    : allocateJudgingAssignments(
        event.judgingSubmissions,
        judges,
        event.judgesPerProject
      );
  const preview: JudgingAssignmentPreview = {
    published,
    judgesPerProject: event.judgesPerProject,
    tracks: event.judgingTracks,
    judges: event.judges.map(judge => {
      const assigned = new Set(
        assignments
          .filter(item => item.judgeId === judge.id)
          .map(item => item.submissionId)
      );
      const trackCounts: Record<string, number> = {};
      for (const project of event.judgingSubmissions) {
        if (assigned.has(project.id))
          trackCounts[project.trackId] =
            (trackCounts[project.trackId] ?? 0) + 1;
      }
      return {
        id: judge.id,
        name: judge.name || judge.email,
        total: assigned.size,
        trackCounts,
      };
    }),
    projects: event.judgingSubmissions.map(project => {
      const assigned = new Set(
        assignments
          .filter(item => item.submissionId === project.id)
          .map(item => item.judgeId)
      );
      const criteria = event.judgingCriteria.filter(
        item => item.trackId === null || item.trackId === project.trackId
      );
      return {
        id: project.id,
        title: project.project.title,
        trackId: project.trackId,
        assigned: assigned.size,
        completed: project.reviews.filter(
          review =>
            assigned.has(review.judgeId) &&
            isJudgingReviewComplete(
              criteria,
              Object.fromEntries(
                review.scores.map(score => [score.criterionId, score.score])
              )
            )
        ).length,
      };
    }),
    shortages: event.judgingTracks.flatMap(track => {
      const eligible = judges.filter(judge =>
        judge.trackIds.includes(track.id)
      ).length;
      return eligible < event.judgesPerProject &&
        event.judgingSubmissions.some(project => project.trackId === track.id)
        ? [
            {
              trackId: track.id,
              trackName: track.name,
              eligible,
              required: event.judgesPerProject,
            },
          ]
        : [];
    }),
  };
  return { preview, assignments };
}

export async function loadJudgingAssignments(
  eventId: string
): Promise<JudgingAssignmentPreview> {
  return (await assignmentState(eventId, prisma)).preview;
}

export async function loadJudgingConfig(
  eventId: string
): Promise<EventJudgingConfig | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      startTime: true,
      endTime: true,
      timezone: true,
      judgingEnabled: true,
      projectsHidden: true,
      judgingOpen: true,
      judgesPerProject: true,
      judgingAssignmentsPublishedAt: true,
      judgingSubmissionsOpenAt: true,
      judgingSubmissionsCloseAt: true,
      judgingCriteria: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: criterionSelect,
      },
      judgingTracks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          questionsJson: true,
          _count: { select: { submissions: true } },
        },
      },
      judges: {
        orderBy: [{ revokedAt: 'desc' }, { invitedAt: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          hackerId: true,
          invitedAt: true,
          lastSentAt: true,
          lastSeenAt: true,
          revokedAt: true,
          tracks: { select: { trackId: true } },
          reviews: {
            select: {
              submission: { select: { trackId: true } },
              scores: { select: { criterionId: true, score: true } },
            },
          },
        },
      },
    },
  });
  if (!event) return null;

  const criteria = event.judgingCriteria.map(toCriterion);
  return {
    judgingEnabled: event.judgingEnabled,
    projectsHidden: event.projectsHidden,
    judgingOpen: event.judgingOpen,
    judgesPerProject: event.judgesPerProject,
    judgingAssignmentsPublishedAt: iso(event.judgingAssignmentsPublishedAt),
    judgingSubmissionsOpenAt: iso(event.judgingSubmissionsOpenAt),
    judgingSubmissionsCloseAt: iso(event.judgingSubmissionsCloseAt),
    eventStartTime: event.startTime.toISOString(),
    eventEndTime: iso(event.endTime),
    timezone: event.timezone,
    criteria: criteria.filter(criterion => !criterion.trackId),
    tracks: event.judgingTracks.map(track => ({
      id: track.id,
      name: track.name,
      description: track.description,
      questions: parseJudgingQuestions(track.questionsJson),
      criteria: criteria.filter(criterion => criterion.trackId === track.id),
      submissionCount: track._count.submissions,
    })),
    judges: event.judges.map(judge => ({
      id: judge.id,
      email: judge.email,
      name: judge.name,
      hackerId: judge.hackerId,
      trackIds: judge.tracks.map(track => track.trackId),
      invitedAt: judge.invitedAt.toISOString(),
      lastSentAt: iso(judge.lastSentAt),
      lastSeenAt: iso(judge.lastSeenAt),
      revokedAt: iso(judge.revokedAt),
      reviewCount: judge.reviews.filter(review =>
        isJudgingReviewComplete(
          applicableCriteria(criteria, review.submission.trackId),
          Object.fromEntries(
            review.scores.map(score => [score.criterionId, score.score])
          )
        )
      ).length,
    })),
  };
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Accepts an ISO instant or a datetime-local value in the event's timezone. */
function optionalDate(
  value: unknown,
  timezone: string,
  label: string
): Date | null {
  try {
    return parseOptionalEventDateTimeInput(value, timezone, label) ?? null;
  } catch (error) {
    if (error instanceof EventDateTimeInputError) {
      throw new JudgingError(error.message);
    }
    throw error;
  }
}

type CleanCriterion = {
  id: string | null;
  name: string;
  description: string | null;
  weight: number;
};

function cleanCriteria(value: unknown, label: string): CleanCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const name = cleanText(item?.name, MAX_NAME_LENGTH);
    if (!name)
      throw new JudgingError(`${label} criterion ${index + 1} needs a name.`);
    const weight = item?.weight === undefined ? 1 : Number(item.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      throw new JudgingError(`Weight for "${name}" must be between 0 and 100.`);
    }
    return {
      id: typeof item?.id === 'string' && item.id ? item.id : null,
      name,
      description: cleanText(item?.description, MAX_DESCRIPTION_LENGTH) || null,
      weight,
    };
  });
}

function cleanQuestions(value: unknown, trackName: string): JudgingQuestion[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_QUESTIONS) {
    throw new JudgingError(
      `"${trackName}" can have at most ${MAX_QUESTIONS} questions.`
    );
  }
  return value.map((item, index) => {
    const prompt = cleanText(item?.prompt, MAX_PROMPT_LENGTH);
    if (!prompt) {
      throw new JudgingError(
        `Question ${index + 1} in "${trackName}" needs a prompt.`
      );
    }
    const id =
      typeof item?.id === 'string' && item.id && item.id !== 'additionalInfo'
        ? item.id
        : randomUUID();
    return { id, prompt, required: item?.required === true };
  });
}

/**
 * Replaces the event's judging settings, tracks, questions, and criteria with
 * the submitted configuration. Rows are matched by id so existing scores and
 * submissions survive edits; a track with submissions cannot be deleted.
 */
export async function saveJudgingConfig(
  eventId: string,
  input: JudgingConfigInput
): Promise<void> {
  return withJudgingEventLock(eventId, async tx => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        timezone: true,
        judgingEnabled: true,
        projectsHidden: true,
        judgesPerProject: true,
        judgingAssignmentsPublishedAt: true,
        endTime: true,
        judgingSubmissionsOpenAt: true,
        judgingSubmissionsCloseAt: true,
      },
    });
    if (!event) throw new JudgingError('Event not found.', 404);
    if (
      input.projectsHidden !== undefined &&
      typeof input.projectsHidden !== 'boolean'
    ) {
      throw new JudgingError('Project visibility must be on or off.');
    }
    const opensAt = optionalDate(
      input.judgingSubmissionsOpenAt,
      event.timezone,
      'Submission start'
    );
    const closesAt = optionalDate(
      input.judgingSubmissionsCloseAt,
      event.timezone,
      'Submission end'
    );
    if (opensAt && closesAt && closesAt <= opensAt) {
      throw new JudgingError('Submission end must be after submission start.');
    }
    if (
      !Number.isSafeInteger(input.judgesPerProject) ||
      input.judgesPerProject < 1 ||
      input.judgesPerProject > 2147483647
    ) {
      throw new JudgingError(
        'Judges per project must be a positive whole number.'
      );
    }
    const scoringOpen =
      input.judgingEnabled === true && input.judgingOpen === true;
    if (scoringOpen && !event.judgingAssignmentsPublishedAt) {
      const effectiveClose = closesAt ?? event.endTime;
      if (!effectiveClose || effectiveClose >= new Date()) {
        throw new JudgingError(
          'Close project submissions before opening scoring.',
          409
        );
      }
    }

    const rawTracks = Array.isArray(input.tracks) ? input.tracks : [];
    if (rawTracks.length > MAX_TRACKS) {
      throw new JudgingError(`An event can have at most ${MAX_TRACKS} tracks.`);
    }
    const tracks = rawTracks.map((track, index) => {
      const name = cleanText(track?.name, MAX_NAME_LENGTH);
      if (!name) throw new JudgingError(`Track ${index + 1} needs a name.`);
      return {
        id: typeof track?.id === 'string' && track.id ? track.id : null,
        name,
        description:
          cleanText(track?.description, MAX_DESCRIPTION_LENGTH) || null,
        questions: cleanQuestions(track?.questions, name),
        criteria: cleanCriteria(track?.criteria, `"${name}"`),
      };
    });
    const eventCriteria = cleanCriteria(input.criteria, 'Event');
    const criteriaCount =
      eventCriteria.length +
      tracks.reduce((count, track) => count + track.criteria.length, 0);
    if (criteriaCount > MAX_CRITERIA * (tracks.length + 1)) {
      throw new JudgingError('Too many judging criteria.');
    }
    if (input.judgingEnabled === true && tracks.length === 0) {
      throw new JudgingError('Add at least one track before enabling judging.');
    }

    const [existingTracks, existingCriteria] = await Promise.all([
      tx.judgingTrack.findMany({
        where: { eventId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          questionsJson: true,
          _count: { select: { submissions: true } },
        },
      }),
      tx.judgingCriterion.findMany({
        where: { eventId },
        orderBy: { position: 'asc' },
        select: criterionSelect,
      }),
    ]);
    const trackIds = new Set(existingTracks.map(track => track.id));
    const criterionIds = new Set(
      existingCriteria.map(criterion => criterion.id)
    );

    if (event.judgingAssignmentsPublishedAt) {
      const currentCriteria = (trackId: string | null) =>
        existingCriteria
          .filter(criterion => criterion.trackId === trackId)
          .map(({ id, name, description, weight }) => ({
            id,
            name,
            description,
            weight,
          }));
      const currentTracks = existingTracks.map(track => ({
        id: track.id,
        name: track.name,
        description: track.description,
        questions: parseJudgingQuestions(track.questionsJson),
        criteria: currentCriteria(track.id),
      }));
      if (
        input.judgesPerProject !== event.judgesPerProject ||
        JSON.stringify(tracks) !== JSON.stringify(currentTracks) ||
        JSON.stringify(eventCriteria) !==
          JSON.stringify(currentCriteria(null)) ||
        iso(opensAt) !== iso(event.judgingSubmissionsOpenAt) ||
        iso(closesAt) !== iso(event.judgingSubmissionsCloseAt)
      ) {
        throw new JudgingError(
          'Assignments, tracks, criteria, and submission dates are fixed because scoring has started.',
          409
        );
      }
      await tx.event.update({
        where: { id: eventId },
        data: {
          judgingEnabled: input.judgingEnabled === true,
          judgingOpen: scoringOpen,
          projectsHidden: input.projectsHidden ?? event.projectsHidden,
        },
      });
      return;
    }

    for (const track of tracks) {
      if (track.id && !trackIds.has(track.id)) {
        throw new JudgingError(
          'A track no longer exists. Reload and try again.',
          409
        );
      }
    }
    const keptTrackIds = new Set(tracks.map(track => track.id).filter(Boolean));
    const removedTracks = existingTracks.filter(
      track => !keptTrackIds.has(track.id)
    );
    const blocked = removedTracks.find(track => track._count.submissions > 0);
    if (blocked) {
      throw new JudgingError(
        `"${blocked.name}" has project submissions and cannot be deleted.`,
        409
      );
    }

    await tx.event.update({
      where: { id: eventId },
      data: {
        judgingEnabled: input.judgingEnabled === true,
        projectsHidden:
          input.projectsHidden ??
          (input.judgingEnabled === true && !event.judgingEnabled
            ? true
            : event.projectsHidden),
        judgingOpen: scoringOpen,
        judgesPerProject: input.judgesPerProject,
        judgingSubmissionsOpenAt: opensAt,
        judgingSubmissionsCloseAt: closesAt,
      },
    });

    const savedCriteria: Array<
      CleanCriterion & { trackId: string | null; position: number }
    > = eventCriteria.map((criterion, position) => ({
      ...criterion,
      trackId: null,
      position,
    }));

    for (let position = 0; position < tracks.length; position += 1) {
      const track = tracks[position];
      const data = {
        name: track.name,
        description: track.description,
        position,
        questionsJson: track.questions as unknown as Prisma.InputJsonValue,
      };
      const trackId = track.id
        ? (await tx.judgingTrack.update({ where: { id: track.id }, data })).id
        : (await tx.judgingTrack.create({ data: { ...data, eventId } })).id;
      savedCriteria.push(
        ...track.criteria.map((criterion, criterionPosition) => ({
          ...criterion,
          trackId,
          position: criterionPosition,
        }))
      );
    }

    for (const criterion of savedCriteria) {
      if (criterion.id && !criterionIds.has(criterion.id)) {
        throw new JudgingError(
          'A criterion no longer exists. Reload and try again.',
          409
        );
      }
    }
    const keptCriterionIds = new Set(
      savedCriteria.map(criterion => criterion.id).filter(Boolean) as string[]
    );
    await tx.judgingCriterion.deleteMany({
      where: { eventId, id: { notIn: Array.from(keptCriterionIds) } },
    });
    if (removedTracks.length) {
      await tx.judgingTrack.deleteMany({
        where: { id: { in: removedTracks.map(track => track.id) } },
      });
    }
    for (const criterion of savedCriteria) {
      const data = {
        trackId: criterion.trackId,
        name: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        position: criterion.position,
      };
      if (criterion.id) {
        await tx.judgingCriterion.update({ where: { id: criterion.id }, data });
      } else {
        await tx.judgingCriterion.create({ data: { ...data, eventId } });
      }
    }
    if (scoringOpen) {
      const { preview, assignments } = await assignmentState(eventId, tx);
      if (preview.projects.length === 0) {
        throw new JudgingError(
          'Add project submissions before opening scoring.',
          409
        );
      }
      if (preview.shortages.length) {
        throw new JudgingError(
          preview.shortages
            .map(
              track =>
                `${track.trackName} needs ${track.required} judges but has ${track.eligible}.`
            )
            .join(' '),
          409
        );
      }
      const criteria = await tx.judgingCriterion.findMany({
        where: { eventId },
        select: { trackId: true },
      });
      if (
        preview.projects.some(
          project =>
            !criteria.some(
              criterion =>
                criterion.trackId === null ||
                criterion.trackId === project.trackId
            )
        )
      ) {
        throw new JudgingError(
          'Add scoring criteria for every track with projects before opening scoring.',
          409
        );
      }
      await tx.judgingAssignment.createMany({ data: assignments });
      await tx.event.update({
        where: { id: eventId },
        data: { judgingAssignmentsPublishedAt: new Date() },
      });
    }
  });
}

function applicableCriteria(
  criteria: JudgingCriterionConfig[],
  trackId: string
) {
  return criteria.filter(
    criterion => criterion.trackId === null || criterion.trackId === trackId
  );
}

async function loadEventCriteria(
  eventId: string,
  db: Prisma.TransactionClient = prisma
) {
  const rows = await db.judgingCriterion.findMany({
    where: { eventId },
    orderBy: [
      { trackId: { sort: 'asc', nulls: 'first' } },
      { position: 'asc' },
    ],
    select: criterionSelect,
  });
  return rows.map(toCriterion);
}

export async function loadJudgePanel(
  eventId: string,
  judgeId: string
): Promise<JudgePanelPayload | null> {
  const judge = await prisma.eventJudge.update({
    where: { id: judgeId, eventId, revokedAt: null },
    data: { lastSeenAt: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      event: {
        select: {
          judgingOpen: true,
          judgingEnabled: true,
          judgingAssignmentsPublishedAt: true,
          requireGithubUrl: true,
        },
      },
      tracks: {
        orderBy: { track: { position: 'asc' } },
        select: {
          track: {
            select: {
              id: true,
              name: true,
              description: true,
              questionsJson: true,
            },
          },
        },
      },
    },
  });
  if (!judge.event.judgingEnabled) return null;

  const trackIds = judge.tracks.map(({ track }) => track.id);
  const [criteria, submissions] = await Promise.all([
    loadEventCriteria(eventId),
    judge.event.judgingAssignmentsPublishedAt
      ? prisma.judgingSubmission.findMany({
          where: {
            ...judgeableSubmissionWhere(eventId),
            trackId: { in: trackIds },
            assignments: { some: { judgeId } },
          },
          select: {
            id: true,
            trackId: true,
            answersJson: true,
            project: {
              select: {
                id: true,
                title: true,
                preview: true,
                githubUrl: true,
                demoUrl: true,
                blogUrl: true,
                thumbnail: { select: { url: true } },
                launchLead: { select: { name: true } },
                participants: {
                  select: { hacker: { select: { name: true } } },
                },
              },
            },
            reviews: {
              where: { judgeId },
              select: {
                comment: true,
                updatedAt: true,
                scores: { select: { criterionId: true, score: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    judge: { id: judge.id, name: judge.name, email: judge.email },
    judgingOpen: judge.event.judgingOpen,
    assignmentsPublished: Boolean(judge.event.judgingAssignmentsPublishedAt),
    requireGithubUrl: judge.event.requireGithubUrl,
    scoreMin: JUDGING_SCORE_MIN,
    scoreMax: JUDGING_SCORE_MAX,
    tracks: judge.tracks.map(({ track }) => {
      const questions = parseJudgingQuestions(track.questionsJson);
      const projects = submissions
        .filter(submission => submission.trackId === track.id)
        .map(submission => {
          const { project } = submission;
          const review = submission.reviews[0];
          const team = Array.from(
            new Set([
              project.launchLead.name,
              ...project.participants.map(member => member.hacker.name),
            ])
          );
          return {
            submissionId: submission.id,
            projectId: project.id,
            trackId: track.id,
            title: project.title,
            preview: project.preview ?? '',
            thumbnailUrl: project.thumbnail?.url ?? null,
            githubUrl: project.githubUrl,
            demoUrl: project.demoUrl,
            blogUrl: project.blogUrl,
            team,
            answers: judgingAnswerList(
              questions,
              parseJudgingAnswers(submission.answersJson)
            ),
            review: review
              ? {
                  scores: Object.fromEntries(
                    review.scores.map(score => [score.criterionId, score.score])
                  ),
                  comment: review.comment ?? '',
                  updatedAt: review.updatedAt.toISOString(),
                }
              : null,
          };
        });
      return {
        id: track.id,
        name: track.name,
        description: track.description,
        criteria: applicableCriteria(criteria, track.id),
        projects: orderForJudge(judge.id, projects),
      };
    }),
  };
}

export async function saveJudgeReview(input: {
  eventId: string;
  judgeId: string;
  submissionId: string;
  scores: unknown;
  comment: unknown;
}) {
  return withJudgingEventLock(input.eventId, async tx => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: {
        judgingEnabled: true,
        judgingOpen: true,
        judgingAssignmentsPublishedAt: true,
      },
    });
    if (!event?.judgingEnabled)
      throw new JudgingError('Judging is not enabled.', 404);
    if (!event.judgingOpen || !event.judgingAssignmentsPublishedAt)
      throw new JudgingError('Judging is closed.', 409);

    const submission = await tx.judgingSubmission.findFirst({
      where: {
        ...judgeableSubmissionWhere(input.eventId),
        id: input.submissionId,
        assignments: {
          some: {
            judgeId: input.judgeId,
            judge: { eventId: input.eventId, revokedAt: null },
          },
        },
      },
      select: { id: true, trackId: true },
    });
    if (!submission) throw new JudgingError('Project not found.', 404);

    const criteria = applicableCriteria(
      await loadEventCriteria(input.eventId, tx),
      submission.trackId
    );
    const rawScores =
      input.scores &&
      typeof input.scores === 'object' &&
      !Array.isArray(input.scores)
        ? (input.scores as Record<string, unknown>)
        : {};
    const scores: Array<{ criterionId: string; score: number }> = [];
    for (const [criterionId, score] of Object.entries(rawScores)) {
      if (score === null) continue;
      if (!criteria.some(criterion => criterion.id === criterionId)) {
        throw new JudgingError('Unknown judging criterion.');
      }
      if (!isValidJudgingScore(score)) {
        throw new JudgingError(
          `Scores must be whole numbers from ${JUDGING_SCORE_MIN} to ${JUDGING_SCORE_MAX}.`
        );
      }
      scores.push({ criterionId, score });
    }
    const comment = cleanText(input.comment, MAX_COMMENT_LENGTH) || null;

    const review = await tx.judgingReview.upsert({
      where: {
        judgeId_submissionId: {
          judgeId: input.judgeId,
          submissionId: submission.id,
        },
      },
      create: { judgeId: input.judgeId, submissionId: submission.id, comment },
      update: { comment },
      select: { id: true, updatedAt: true },
    });
    await tx.judgingReviewScore.deleteMany({ where: { reviewId: review.id } });
    if (scores.length) {
      await tx.judgingReviewScore.createMany({
        data: scores.map(score => ({ ...score, reviewId: review.id })),
      });
    }
    return {
      scores: Object.fromEntries(
        scores.map(score => [score.criterionId, score.score])
      ),
      comment: comment ?? '',
      updatedAt: review.updatedAt.toISOString(),
    };
  });
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export async function loadJudgingResults(
  eventId: string
): Promise<JudgingResults> {
  const [tracks, criteria, submissions, event] = await Promise.all([
    prisma.judgingTrack.findMany({
      where: { eventId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    loadEventCriteria(eventId),
    prisma.judgingSubmission.findMany({
      where: judgeableSubmissionWhere(eventId),
      select: {
        id: true,
        trackId: true,
        project: { select: { id: true, title: true } },
        _count: { select: { assignments: true } },
        reviews: {
          select: {
            judgeId: true,
            comment: true,
            judge: { select: { name: true, email: true } },
            scores: { select: { criterionId: true, score: true } },
          },
        },
      },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { judgesPerProject: true },
    }),
  ]);

  if (!event) throw new JudgingError('Event not found.', 404);
  const trackNames = new Map(tracks.map(track => [track.id, track.name]));

  const scoredReviews: ScoredReview[] = [];
  const rowReviews = submissions.map(submission => {
    const trackCriteria = applicableCriteria(criteria, submission.trackId);
    return submission.reviews.map(review => {
      const scores = Object.fromEntries(
        review.scores.map(score => [score.criterionId, score.score])
      );
      const score = isJudgingReviewComplete(trackCriteria, scores)
        ? weightedReviewScore(trackCriteria, scores)
        : null;
      const scored =
        score === null
          ? null
          : { judgeId: review.judgeId, submissionId: submission.id, score };
      if (scored) scoredReviews.push(scored);
      return { review, scores, score, scored };
    });
  });
  const normalized = normalizeReviewScores(scoredReviews);

  const rows: JudgingLeaderboardRow[] = submissions.map((submission, index) => {
    const reviews = rowReviews[index];
    const scored = reviews.flatMap(item => (item.scored ? [item.scored] : []));
    const criterionAverages: Record<string, number> = {};
    for (const criterion of applicableCriteria(criteria, submission.trackId)) {
      const value = average(
        reviews.flatMap(item =>
          item.score === null || item.scores[criterion.id] === undefined
            ? []
            : [item.scores[criterion.id]]
        )
      );
      if (value !== null) criterionAverages[criterion.id] = roundScore(value)!;
    }
    return {
      submissionId: submission.id,
      projectId: submission.project.id,
      title: submission.project.title,
      trackId: submission.trackId,
      trackName: trackNames.get(submission.trackId) ?? '',
      judgeCount: scored.length,
      assignedJudgeCount: submission._count.assignments,
      requiredJudgeCount: event.judgesPerProject,
      rawScore: roundScore(average(scored.map(review => review.score))),
      normalizedScore: roundScore(
        average(scored.map(review => normalized.get(review)!))
      ),
      criterionAverages,
      reviews: reviews.map(({ review, scores, score }) => ({
        judgeId: review.judgeId,
        judgeName: review.judge.name || review.judge.email,
        score: roundScore(score),
        scores,
        comment: review.comment,
      })),
    };
  });

  const ranked = [...rows].sort(
    (a, b) =>
      (b.normalizedScore ?? -Infinity) - (a.normalizedScore ?? -Infinity) ||
      (b.rawScore ?? -Infinity) - (a.rawScore ?? -Infinity) ||
      a.title.localeCompare(b.title)
  );

  return {
    scoreMin: JUDGING_SCORE_MIN,
    scoreMax: JUDGING_SCORE_MAX,
    overall: ranked,
    tracks: tracks.map(track => ({
      id: track.id,
      name: track.name,
      criteria: applicableCriteria(criteria, track.id),
      rows: ranked.filter(row => row.trackId === track.id),
    })),
  };
}

const judgingEventSelect = {
  id: true,
  startTime: true,
  endTime: true,
  judgingEnabled: true,
  judgingOpen: true,
  judgingSubmissionsOpenAt: true,
  judgingSubmissionsCloseAt: true,
} satisfies Prisma.EventSelect;

/** Judging tracks and any existing answers for each judging event offered to a project. */
export async function loadProjectJudgingOptions(
  eventIds: string[],
  projectId: string | null
): Promise<Map<string, ProjectJudgingOption>> {
  const options = new Map<string, ProjectJudgingOption>();
  if (eventIds.length === 0) return options;

  const [tracks, submissions] = await Promise.all([
    prisma.judgingTrack.findMany({
      where: { eventId: { in: eventIds }, event: { judgingEnabled: true } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        eventId: true,
        name: true,
        description: true,
        questionsJson: true,
      },
    }),
    projectId
      ? prisma.judgingSubmission.findMany({
          where: { projectId, eventId: { in: eventIds } },
          select: { eventId: true, trackId: true, answersJson: true },
        })
      : Promise.resolve([]),
  ]);

  for (const track of tracks) {
    const option = options.get(track.eventId) ?? {
      tracks: [],
      submission: null,
    };
    option.tracks.push({
      id: track.id,
      name: track.name,
      description: track.description,
      questions: parseJudgingQuestions(track.questionsJson),
    });
    options.set(track.eventId, option);
  }
  for (const submission of submissions) {
    const option = options.get(submission.eventId);
    if (option) {
      option.submission = {
        trackId: submission.trackId,
        answers: parseJudgingAnswers(submission.answersJson),
      };
    }
  }
  return options;
}

/** Event window filter for judging events whose submission window is overridden. */
export function judgingSubmissionWindowWhere(
  now: Date
): Prisma.EventWhereInput {
  return {
    judgingEnabled: true,
    judgingAssignmentsPublishedAt: null,
    OR: [
      { judgingSubmissionsOpenAt: { lte: now } },
      { judgingSubmissionsOpenAt: null, startTime: { lte: now } },
    ],
    AND: [
      {
        OR: [
          { judgingSubmissionsCloseAt: { gte: now } },
          { judgingSubmissionsCloseAt: null, endTime: { gte: now } },
          { judgingSubmissionsCloseAt: null, endTime: null },
        ],
      },
    ],
  };
}

/**
 * Saves a participant's track and answers for a judging event and regenerates
 * the project's long description from them.
 */
export async function saveProjectJudgingSubmission(input: {
  projectId: string;
  eventId: string;
  trackId: unknown;
  answers: unknown;
  actorId: string;
  bypassWindow: boolean;
}): Promise<{ description: string }> {
  return withJudgingEventLock(input.eventId, async tx => {
    const [event, otherSubmission] = await Promise.all([
      tx.event.findUnique({
        where: { id: input.eventId },
        select: {
          ...judgingEventSelect,
          judgingAssignmentsPublishedAt: true,
          judgingTracks: {
            select: { id: true, questionsJson: true },
          },
        },
      }),
      tx.judgingSubmission.findFirst({
        where: {
          projectId: input.projectId,
          eventId: { not: input.eventId },
          event: {
            judgingEnabled: true,
            projects: { some: { projectId: input.projectId } },
          },
        },
        select: { event: { select: { title: true } } },
      }),
    ]);
    if (!event?.judgingEnabled) {
      throw new JudgingError(
        'This event is not accepting judged projects.',
        404
      );
    }
    const existing = await tx.judgingSubmission.findUnique({
      where: {
        eventId_projectId: {
          eventId: input.eventId,
          projectId: input.projectId,
        },
      },
      select: { id: true, trackId: true },
    });
    const canEditAfterJudging = Boolean(existing) && hasJudgingConcluded(event);
    if (
      !input.bypassWindow &&
      !canEditAfterJudging &&
      (event.judgingAssignmentsPublishedAt ||
        !isJudgingSubmissionWindowOpen(event))
    ) {
      throw new JudgingError('Submissions for this event are closed.', 409);
    }
    if (otherSubmission) {
      throw new JudgingError(
        `This project is already submitted for judging at ${otherSubmission.event.title}.`,
        409
      );
    }

    const track = event.judgingTracks.find(item => item.id === input.trackId);
    if (!track) throw new JudgingError('Choose a track for this project.');
    const questions = parseJudgingQuestions(track.questionsJson);
    const answers: JudgingAnswers = normalizeJudgingAnswers(
      questions,
      parseJudgingAnswers(input.answers)
    );
    const missing = missingRequiredJudgingAnswers(questions, answers);
    if (missing.length) {
      throw new JudgingError(`Answer "${missing[0].prompt}" before saving.`);
    }

    const description = composeJudgingDescription(questions, answers);
    const answersJson = answers as Prisma.InputJsonValue;
    if (
      event.judgingAssignmentsPublishedAt &&
      (!existing || existing.trackId !== track.id)
    ) {
      throw new JudgingError(
        'Project assignments are fixed because scoring has started.',
        409
      );
    }
    if (existing && existing.trackId !== track.id) {
      // Scores from the previous track's judges no longer apply.
      await tx.judgingReview.deleteMany({
        where: { submissionId: existing.id },
      });
    }
    await tx.judgingSubmission.upsert({
      where: {
        eventId_projectId: {
          eventId: input.eventId,
          projectId: input.projectId,
        },
      },
      create: {
        eventId: input.eventId,
        projectId: input.projectId,
        trackId: track.id,
        answersJson,
        submittedById: input.actorId,
      },
      update: { trackId: track.id, answersJson },
    });
    await tx.project.update({
      where: { id: input.projectId },
      data: { description },
    });
    return { description };
  });
}

async function eventTrackIds(
  eventId: string,
  value: unknown,
  tx: Prisma.TransactionClient
): Promise<string[]> {
  if (!Array.isArray(value))
    throw new JudgingError('Choose at least one track.');
  const requested = Array.from(
    new Set(value.filter((id): id is string => typeof id === 'string'))
  );
  if (requested.length === 0)
    throw new JudgingError('Choose at least one track.');
  const tracks = await tx.judgingTrack.findMany({
    where: { eventId, id: { in: requested } },
    select: { id: true },
  });
  if (tracks.length !== requested.length) {
    throw new JudgingError('A selected track no longer exists.', 409);
  }
  return requested;
}

/**
 * Creates (or restores a revoked) judge for an existing account or a bare
 * email address. Sending the invite is left to the caller.
 */
export async function upsertEventJudge(input: {
  eventId: string;
  actorId: string;
  hackerId: unknown;
  email: unknown;
  name: unknown;
  trackIds: unknown;
}): Promise<string> {
  return withJudgingEventLock(input.eventId, async tx => {
    await requireDraftAssignments(tx, input.eventId);
    let email =
      typeof input.email === 'string' ? normalizeJudgeEmail(input.email) : '';
    let name = cleanText(input.name, MAX_NAME_LENGTH) || null;
    let hackerId: string | null = null;
    if (typeof input.hackerId === 'string' && input.hackerId) {
      const hacker = await tx.hacker.findUnique({
        where: { id: input.hackerId },
        select: { id: true, name: true, email: true },
      });
      if (!hacker) throw new JudgingError('User not found.', 404);
      if (!hacker.email) {
        throw new JudgingError(`${hacker.name} has no email address on file.`);
      }
      hackerId = hacker.id;
      email = normalizeJudgeEmail(hacker.email);
      name = name ?? hacker.name;
    }
    if (!isValidJudgeEmail(email))
      throw new JudgingError('Enter a valid email address.');
    const trackIds = await eventTrackIds(input.eventId, input.trackIds, tx);

    const existing = await tx.eventJudge.findUnique({
      where: { eventId_email: { eventId: input.eventId, email } },
      select: { id: true, revokedAt: true },
    });
    if (existing && !existing.revokedAt) {
      throw new JudgingError(
        `${email} is already a judge for this event.`,
        409
      );
    }

    const tracks = { create: trackIds.map(trackId => ({ trackId })) };
    if (existing) {
      await tx.eventJudgeTrack.deleteMany({ where: { judgeId: existing.id } });
      await tx.eventJudge.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          name,
          hackerId,
          invitedById: input.actorId,
          invitedAt: new Date(),
          tracks,
        },
      });
      return existing.id;
    }

    const judge = await tx.eventJudge.create({
      data: {
        eventId: input.eventId,
        email,
        name,
        hackerId,
        invitedById: input.actorId,
        // Replaced with a deliverable token when the invite is sent.
        tokenHash: createJudgeToken().tokenHash,
        tracks,
      },
      select: { id: true },
    });
    return judge.id;
  });
}

export async function updateEventJudge(input: {
  eventId: string;
  judgeId: string;
  name?: unknown;
  trackIds?: unknown;
}) {
  return withJudgingEventLock(input.eventId, async tx => {
    if (input.trackIds !== undefined)
      await requireDraftAssignments(tx, input.eventId);
    const judge = await tx.eventJudge.findFirst({
      where: { id: input.judgeId, eventId: input.eventId },
      select: { id: true },
    });
    if (!judge) throw new JudgingError('Judge not found.', 404);
    const trackIds =
      input.trackIds === undefined
        ? null
        : await eventTrackIds(input.eventId, input.trackIds, tx);

    if (trackIds) {
      await tx.eventJudgeTrack.deleteMany({ where: { judgeId: judge.id } });
      await tx.eventJudgeTrack.createMany({
        data: trackIds.map(trackId => ({ judgeId: judge.id, trackId })),
      });
    }
    if (input.name !== undefined) {
      await tx.eventJudge.update({
        where: { id: judge.id },
        data: { name: cleanText(input.name, MAX_NAME_LENGTH) || null },
      });
    }
  });
}

/** Revoking keeps submitted reviews but cuts off the judge's link immediately. */
export async function revokeEventJudge(eventId: string, judgeId: string) {
  return withJudgingEventLock(eventId, async tx => {
    const result = await tx.eventJudge.updateMany({
      where: { id: judgeId, eventId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new JudgingError('Judge not found.', 404);
  });
}
