import {
  composeJudgingDescription,
  isJudgingSubmissionWindowOpen,
  isValidJudgingScore,
  limitToOneJudgingEvent,
  missingRequiredJudgingAnswers,
  normalizeJudgingAnswers,
  normalizeReviewScores,
  orderForJudge,
  parseJudgingQuestions,
  selectProjectEvent,
  weightedReviewScore,
} from '../../src/lib/judging';

const questions = [
  { id: 'problem', prompt: 'What problem does it solve?', required: true },
  { id: 'stack', prompt: 'How did you build it?', required: false },
];

describe('judging questions and answers', () => {
  it('drops malformed questions and reserves the additional info key', () => {
    expect(
      parseJudgingQuestions([
        questions[0],
        { id: 'additionalInfo', prompt: 'Sneaky', required: true },
        { id: 'blank', prompt: '   ' },
        'not a question',
        { id: 'optional', prompt: ' Optional? ' },
      ])
    ).toEqual([
      questions[0],
      { id: 'optional', prompt: 'Optional?', required: false },
    ]);
  });

  it('keeps only the track answers plus additional info', () => {
    expect(
      normalizeJudgingAnswers(questions, {
        problem: '  Food waste ',
        other: 'ignored',
        additionalInfo: 'Demo at 5pm',
      })
    ).toEqual({
      problem: 'Food waste',
      stack: '',
      additionalInfo: 'Demo at 5pm',
    });
  });

  it('reports unanswered required questions', () => {
    expect(
      missingRequiredJudgingAnswers(questions, {
        problem: ' ',
        stack: 'Next.js',
      })
    ).toEqual([questions[0]]);
  });

  it('builds the project description from answered questions in order', () => {
    expect(
      composeJudgingDescription(questions, {
        problem: 'Food waste',
        stack: '',
        additionalInfo: 'Demo at 5pm',
      })
    ).toBe(
      '### What problem does it solve?\n\nFood waste\n\n### Additional info\n\nDemo at 5pm'
    );
  });
});

describe('judging submission window', () => {
  const event = {
    startTime: '2026-10-10T14:00:00.000Z',
    endTime: '2026-10-10T22:00:00.000Z',
    judgingSubmissionsOpenAt: null,
    judgingSubmissionsCloseAt: null,
  };

  it('defaults to the event window', () => {
    expect(
      isJudgingSubmissionWindowOpen(event, new Date('2026-10-10T15:00:00Z'))
    ).toBe(true);
    expect(
      isJudgingSubmissionWindowOpen(event, new Date('2026-10-10T23:00:00Z'))
    ).toBe(false);
  });

  it('uses overridden start and end times', () => {
    const extended = {
      ...event,
      judgingSubmissionsCloseAt: '2026-10-12T00:00:00.000Z',
    };
    expect(
      isJudgingSubmissionWindowOpen(extended, new Date('2026-10-11T12:00:00Z'))
    ).toBe(true);
  });
});

describe('judging scores', () => {
  it('accepts whole scores from 1 to 5', () => {
    expect([1, 5].every(isValidJudgingScore)).toBe(true);
    expect([0, 6, 2.5, '4', null].some(isValidJudgingScore)).toBe(false);
  });

  it('weights scored criteria and ignores unscored ones', () => {
    const criteria = [
      { id: 'idea', weight: 1 },
      { id: 'build', weight: 3 },
      { id: 'pitch', weight: 1 },
    ];
    expect(weightedReviewScore(criteria, { idea: 1, build: 5 })).toBe(4);
    expect(weightedReviewScore(criteria, {})).toBeNull();
  });

  it('normalizes away a harsh judge so equal relative rankings tie', () => {
    const reviews = [
      { judgeId: 'harsh', submissionId: 'a', score: 2 },
      { judgeId: 'harsh', submissionId: 'b', score: 1 },
      { judgeId: 'kind', submissionId: 'c', score: 5 },
      { judgeId: 'kind', submissionId: 'd', score: 4 },
    ];
    const normalized = normalizeReviewScores(reviews);
    // Each judge's favorite lands at the same normalized score.
    expect(normalized.get(reviews[0])).toBeCloseTo(normalized.get(reviews[2])!);
    expect(normalized.get(reviews[1])).toBeCloseTo(normalized.get(reviews[3])!);
    expect(normalized.get(reviews[0])!).toBeGreaterThan(
      normalized.get(reviews[1])!
    );
  });

  it('gives a judge with no spread the pooled mean', () => {
    const reviews = [
      { judgeId: 'flat', submissionId: 'a', score: 3 },
      { judgeId: 'other', submissionId: 'b', score: 1 },
      { judgeId: 'other', submissionId: 'c', score: 5 },
    ];
    expect(normalizeReviewScores(reviews).get(reviews[0])).toBeCloseTo(3);
  });
});

describe('judging order and event selection', () => {
  it('orders projects differently per judge but stably', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      submissionId: `s${index}`,
    }));
    const first = orderForJudge('judge-1', items).map(
      item => item.submissionId
    );
    expect(
      orderForJudge('judge-1', items).map(item => item.submissionId)
    ).toEqual(first);
    expect(
      orderForJudge('judge-2', items).map(item => item.submissionId)
    ).not.toEqual(first);
    expect([...first].sort()).toEqual(items.map(item => item.submissionId));
  });

  const events = [
    { id: 'plain', judging: null },
    { id: 'judged-1', judging: {} },
    { id: 'judged-2', judging: {} },
  ];

  it('allows only one judging event at a time', () => {
    expect(
      selectProjectEvent(['plain', 'judged-1'], events, 'judged-2', true)
    ).toEqual(['plain', 'judged-2']);
    expect(selectProjectEvent(['judged-1'], events, 'plain', true)).toEqual([
      'judged-1',
      'plain',
    ]);
    expect(selectProjectEvent(['judged-1'], events, 'judged-1', false)).toEqual(
      []
    );
  });

  it('keeps the first judging event in a default selection', () => {
    expect(
      limitToOneJudgingEvent(['judged-1', 'plain', 'judged-2'], events)
    ).toEqual(['judged-1', 'plain']);
  });
});
