import {
  JudgingError,
  loadJudgingResults,
  loadJudgingAssignments,
  loadJudgePanel,
  upsertEventJudge,
  updateEventJudge,
  saveJudgeReview,
  saveJudgingConfig,
  saveProjectJudgingSubmission,
} from '../../src/lib/judgingData';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

jest.mock('../../src/lib/prisma', () => {
  const client = {
    $queryRaw: jest.fn(),
    judgingAssignment: { createMany: jest.fn() },
    eventJudge: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    event: { findUnique: jest.fn(), update: jest.fn() },
    eventProject: { findUnique: jest.fn() },
    judgingTrack: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    judgingCriterion: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    judgingSubmission: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    judgingReview: { upsert: jest.fn(), deleteMany: jest.fn() },
    judgingReviewScore: { deleteMany: jest.fn(), createMany: jest.fn() },
    eventJudgeTrack: { findMany: jest.fn() },
    project: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((operation: unknown) =>
    typeof operation === 'function'
      ? operation(client)
      : Promise.all(operation as unknown[])
  );
  return { __esModule: true, default: client };
});

const prisma = require('../../src/lib/prisma').default;

const eventCriterion = {
  id: 'crit-idea',
  trackId: null,
  name: 'Idea',
  description: null,
  weight: 1,
};
const trackCriterion = {
  id: 'crit-ml',
  trackId: 'track-ai',
  name: 'ML depth',
  description: null,
  weight: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((operation: unknown) =>
    typeof operation === 'function'
      ? (operation as (tx: unknown) => unknown)(prisma)
      : Promise.all(operation as unknown[])
  );
});

describe('saveJudgeReview', () => {
  const input = {
    eventId: 'event-1',
    judgeId: 'judge-1',
    submissionId: 'submission-1',
    scores: { 'crit-idea': 4, 'crit-ml': 3 },
    comment: '  Strong demo ',
  };

  beforeEach(() => {
    prisma.event.findUnique.mockResolvedValue({
      judgingEnabled: true,
      judgingOpen: true,
      judgingAssignmentsPublishedAt: new Date(),
    });
    prisma.judgingSubmission.findFirst.mockResolvedValue({
      id: 'submission-1',
      trackId: 'track-ai',
    });
    prisma.judgingCriterion.findMany.mockResolvedValue([
      eventCriterion,
      trackCriterion,
    ]);
    prisma.judgingReview.upsert.mockResolvedValue({
      id: 'review-1',
      updatedAt: new Date('2026-10-10T12:00:00Z'),
    });
  });

  it('replaces the judge scores for an assigned project', async () => {
    await expect(saveJudgeReview(input)).resolves.toEqual({
      scores: { 'crit-idea': 4, 'crit-ml': 3 },
      comment: 'Strong demo',
      updatedAt: '2026-10-10T12:00:00.000Z',
    });
    expect(prisma.judgingSubmission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'submission-1',
          assignments: {
            some: {
              judgeId: 'judge-1',
              judge: { eventId: 'event-1', revokedAt: null },
            },
          },
        }),
      })
    );
    expect(prisma.judgingReviewScore.deleteMany).toHaveBeenCalledWith({
      where: { reviewId: 'review-1' },
    });
    expect(prisma.judgingReviewScore.createMany).toHaveBeenCalledWith({
      data: [
        { criterionId: 'crit-idea', score: 4, reviewId: 'review-1' },
        { criterionId: 'crit-ml', score: 3, reviewId: 'review-1' },
      ],
    });
  });

  it('rejects scores once judging is closed', async () => {
    prisma.event.findUnique.mockResolvedValue({
      judgingEnabled: true,
      judgingOpen: false,
    });
    await expect(saveJudgeReview(input)).rejects.toMatchObject({ status: 409 });
    expect(prisma.judgingReview.upsert).not.toHaveBeenCalled();
  });

  it('hides projects outside the judge tracks', async () => {
    prisma.judgingSubmission.findFirst.mockResolvedValue(null);
    await expect(saveJudgeReview(input)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects out-of-range scores and criteria from other tracks', async () => {
    await expect(
      saveJudgeReview({ ...input, scores: { 'crit-idea': 11 } })
    ).rejects.toBeInstanceOf(JudgingError);
    prisma.judgingCriterion.findMany.mockResolvedValue([
      eventCriterion,
      { ...trackCriterion, trackId: 'track-web' },
    ]);
    await expect(saveJudgeReview(input)).rejects.toThrow(
      'Unknown judging criterion.'
    );
  });
});

describe('loadJudgingResults', () => {
  it('ranks by normalized score and reports judge coverage', async () => {
    prisma.event.findUnique.mockResolvedValue({ judgesPerProject: 3 });
    prisma.judgingTrack.findMany.mockResolvedValue([
      { id: 'track-ai', name: 'AI' },
    ]);
    prisma.judgingCriterion.findMany.mockResolvedValue([eventCriterion]);
    prisma.eventJudgeTrack.findMany.mockResolvedValue([
      { trackId: 'track-ai' },
      { trackId: 'track-ai' },
    ]);
    const review = (judgeId: string, score: number) => ({
      judgeId,
      comment: null,
      judge: { name: judgeId, email: `${judgeId}@example.com` },
      scores: [{ criterionId: 'crit-idea', score }],
    });
    prisma.judgingSubmission.findMany.mockResolvedValue([
      {
        id: 's-low',
        trackId: 'track-ai',
        _count: { assignments: 2 },
        project: { id: 'p-low', title: 'Low' },
        reviews: [review('harsh', 1)],
      },
      {
        id: 's-high',
        trackId: 'track-ai',
        _count: { assignments: 2 },
        project: { id: 'p-high', title: 'High' },
        reviews: [review('harsh', 2), review('kind', 5)],
      },
      {
        id: 's-unscored',
        trackId: 'track-ai',
        _count: { assignments: 2 },
        project: { id: 'p-none', title: 'Unscored' },
        reviews: [],
      },
    ]);

    const results = await loadJudgingResults('event-1');

    expect(results.overall.map(row => row.title)).toEqual([
      'High',
      'Low',
      'Unscored',
    ]);
    expect(results.overall[0]).toMatchObject({
      judgeCount: 2,
      assignedJudgeCount: 2,
      rawScore: 3.5,
      criterionAverages: { 'crit-idea': 3.5 },
    });
    expect(results.overall[2]).toMatchObject({
      rawScore: null,
      normalizedScore: null,
    });
    expect(results.tracks[0].rows).toHaveLength(3);
  });
});

describe('saveJudgingConfig', () => {
  beforeEach(() => {
    prisma.event.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
    prisma.judgingCriterion.findMany.mockResolvedValue([]);
  });

  it('refuses to delete a track that has submissions', async () => {
    prisma.judgingTrack.findMany.mockResolvedValue([
      { id: 'track-ai', name: 'AI', _count: { submissions: 2 } },
    ]);
    await expect(
      saveJudgingConfig('event-1', {
        judgingEnabled: false,
        judgingOpen: false,
        judgesPerProject: 3,
        judgingSubmissionsOpenAt: null,
        judgingSubmissionsCloseAt: null,
        criteria: [],
        tracks: [],
      })
    ).rejects.toThrow('"AI" has project submissions and cannot be deleted.');
  });

  it('stores submission windows in the event timezone', async () => {
    prisma.judgingTrack.findMany.mockResolvedValue([]);
    prisma.judgingTrack.create.mockResolvedValue({ id: 'track-new' });
    await saveJudgingConfig('event-1', {
      judgingEnabled: true,
      judgingOpen: false,
      judgesPerProject: 3,
      judgingSubmissionsOpenAt: '2026-10-10T09:00',
      judgingSubmissionsCloseAt: null,
      criteria: [{ name: 'Idea', description: null, weight: 2 }],
      tracks: [
        {
          name: 'AI',
          description: null,
          questions: [{ id: 'q1', prompt: 'What?', required: true }],
          criteria: [],
        },
      ],
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({
        judgingEnabled: true,
        judgingSubmissionsOpenAt: new Date('2026-10-10T13:00:00.000Z'),
      }),
    });
    expect(prisma.judgingCriterion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Idea',
        weight: 2,
        trackId: null,
        eventId: 'event-1',
      }),
    });
  });

  it('requires a track before judging is enabled', async () => {
    await expect(
      saveJudgingConfig('event-1', {
        judgingEnabled: true,
        judgingOpen: false,
        judgesPerProject: 3,
        judgingSubmissionsOpenAt: null,
        judgingSubmissionsCloseAt: null,
        criteria: [],
        tracks: [],
      })
    ).rejects.toThrow('Add at least one track before enabling judging.');
  });

  it.each([true, false])(
    'saves the project visibility choice: %s',
    async projectsHidden => {
      prisma.event.findUnique.mockResolvedValue({
        timezone: 'America/New_York',
        judgingEnabled: true,
        projectsHidden: !projectsHidden,
      });
      prisma.judgingTrack.findMany.mockResolvedValue([]);
      prisma.judgingTrack.create.mockResolvedValue({ id: 'track-new' });
      await saveJudgingConfig('event-1', {
        judgingEnabled: true,
        projectsHidden,
        judgingOpen: false,
        judgesPerProject: 3,
        judgingSubmissionsOpenAt: null,
        judgingSubmissionsCloseAt: null,
        criteria: [],
        tracks: [
          { name: 'General', description: null, questions: [], criteria: [] },
        ],
      });
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectsHidden }),
        })
      );
    }
  );

  it('hides projects by default when enabling judging without a visibility choice', async () => {
    prisma.event.findUnique.mockResolvedValue({
      timezone: 'America/New_York',
      judgingEnabled: false,
      projectsHidden: false,
    });
    prisma.judgingTrack.findMany.mockResolvedValue([]);
    prisma.judgingTrack.create.mockResolvedValue({ id: 'track-new' });
    await saveJudgingConfig('event-1', {
      judgingEnabled: true,
      judgingOpen: false,
      judgesPerProject: 3,
      judgingSubmissionsOpenAt: null,
      judgingSubmissionsCloseAt: null,
      criteria: [],
      tracks: [
        { name: 'General', description: null, questions: [], criteria: [] },
      ],
    } as Parameters<typeof saveJudgingConfig>[1]);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectsHidden: true }),
      })
    );
  });

  it('rejects a non-boolean visibility value', async () => {
    await expect(
      saveJudgingConfig('event-1', { projectsHidden: 'false' } as any)
    ).rejects.toThrow('Project visibility must be on or off.');
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});

describe('saveProjectJudgingSubmission', () => {
  const now = new Date('2026-10-10T15:00:00.000Z');
  const event = {
    id: 'event-1',
    startTime: new Date('2026-10-10T14:00:00.000Z'),
    endTime: new Date('2026-10-10T22:00:00.000Z'),
    judgingEnabled: true,
    judgingSubmissionsOpenAt: null,
    judgingSubmissionsCloseAt: null,
    judgingTracks: [
      {
        id: 'track-ai',
        questionsJson: [
          { id: 'q1', prompt: 'What did you build?', required: true },
        ],
      },
      { id: 'track-web', questionsJson: [] },
    ],
  };
  const input = {
    projectId: 'project-1',
    eventId: 'event-1',
    trackId: 'track-ai',
    answers: { q1: 'A robot', additionalInfo: 'Built in 6h' },
    actorId: 'hacker-1',
    bypassWindow: false,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma.event.findUnique.mockResolvedValue(event);
    prisma.judgingSubmission.findFirst.mockResolvedValue(null);
    prisma.judgingSubmission.findUnique.mockResolvedValue(null);
  });

  afterEach(() => jest.useRealTimers());

  it('stores answers and regenerates the project description', async () => {
    await expect(saveProjectJudgingSubmission(input)).resolves.toEqual({
      description:
        '### What did you build?\n\nA robot\n\n### Additional info\n\nBuilt in 6h',
    });
    expect(prisma.judgingSubmission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          trackId: 'track-ai',
          answersJson: { q1: 'A robot', additionalInfo: 'Built in 6h' },
        }),
      })
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { description: expect.stringContaining('A robot') },
    });
  });

  it('requires required answers', async () => {
    await expect(
      saveProjectJudgingSubmission({ ...input, answers: { q1: ' ' } })
    ).rejects.toThrow('Answer "What did you build?" before saving.');
  });

  it('rejects submissions after the window unless an organizer bypasses it', async () => {
    jest.setSystemTime(new Date('2026-10-11T00:00:00.000Z'));
    await expect(saveProjectJudgingSubmission(input)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      saveProjectJudgingSubmission({ ...input, bypassWindow: true })
    ).resolves.toBeDefined();
  });

  it('allows existing answers to change after judging concludes', async () => {
    jest.setSystemTime(new Date('2026-10-11T00:00:00.000Z'));
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      judgingOpen: false,
      judgingAssignmentsPublishedAt: now,
    });
    prisma.judgingSubmission.findUnique.mockResolvedValue({
      id: 'submission-1', trackId: 'track-ai',
    });
    await expect(saveProjectJudgingSubmission(input)).resolves.toBeDefined();
    expect(prisma.project.update).toHaveBeenCalled();
  });

  it.each([true, false])('does not accept new submissions after scoring starts (open=%s)', async judgingOpen => {
    prisma.event.findUnique.mockResolvedValue({
      ...event, judgingOpen, judgingAssignmentsPublishedAt: now,
    });
    await expect(saveProjectJudgingSubmission(input)).rejects.toMatchObject({ status: 409 });
    expect(prisma.judgingSubmission.upsert).not.toHaveBeenCalled();
  });

  it('keeps existing answers locked during scoring', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...event, judgingOpen: true, judgingAssignmentsPublishedAt: now,
    });
    prisma.judgingSubmission.findUnique.mockResolvedValue({
      id: 'submission-1', trackId: 'track-ai',
    });
    await expect(saveProjectJudgingSubmission(input)).rejects.toMatchObject({ status: 409 });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('allows only one judged event per project', async () => {
    prisma.judgingSubmission.findFirst.mockResolvedValue({
      event: { title: 'Other Demo Day' },
    });
    await expect(saveProjectJudgingSubmission(input)).rejects.toThrow(
      'already submitted for judging at Other Demo Day'
    );
  });

  it('clears reviews from the old track when the project changes tracks', async () => {
    prisma.judgingSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      trackId: 'track-web',
    });
    await saveProjectJudgingSubmission(input);
    expect(prisma.judgingReview.deleteMany).toHaveBeenCalledWith({
      where: { submissionId: 'submission-1' },
    });
  });
});
