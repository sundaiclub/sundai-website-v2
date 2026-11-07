import {
  allocateJudgingAssignments as allocate,
  pullJudgingAssignments as pull,
  reassignJudgingAssignments as reassign,
} from '@/lib/judgingAssignments';
import { orderForJudge } from '@/lib/judging';

const projects = (trackId: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${trackId}-${i}`, trackId }));

it('balances total work and splits shared judges between equally sized tracks', () => {
  const submissions = [...projects('a', 12), ...projects('b', 12)];
  const judges = [
    { id: 'a1', trackIds: ['a'] },
    { id: 'a2', trackIds: ['a'] },
    { id: 'b1', trackIds: ['b'] },
    { id: 'b2', trackIds: ['b'] },
    { id: 'shared1', trackIds: ['a', 'b'] },
    { id: 'shared2', trackIds: ['a', 'b'] },
  ];
  const assigned = allocate(submissions, judges, 2);
  expect(assigned).toHaveLength(48);
  for (const project of submissions) {
    expect(
      new Set(
        assigned
          .filter(item => item.submissionId === project.id)
          .map(item => item.judgeId)
      ).size
    ).toBe(2);
  }
  for (const judge of judges)
    expect(assigned.filter(item => item.judgeId === judge.id)).toHaveLength(8);
  for (const id of ['shared1', 'shared2']) {
    expect(
      assigned.filter(
        item => item.judgeId === id && item.submissionId.startsWith('a-')
      )
    ).toHaveLength(4);
  }
  expect(
    allocate([...submissions].reverse(), [...judges].reverse(), 2)
  ).toEqual(assigned);
});

it('fully covers a scarce track even when its judge must take far more work', () => {
  const assigned = allocate(
    [...projects('a', 20), ...projects('b', 2)],
    [
      { id: 'shared', trackIds: ['a', 'b'] },
      { id: 'b-only', trackIds: ['b'] },
    ],
    1
  );
  expect(assigned.filter(item => item.judgeId === 'shared')).toHaveLength(20);
  expect(assigned.filter(item => item.judgeId === 'b-only')).toHaveLength(2);
});

it('adds available judges without duplicate assignments when coverage is impossible', () => {
  const assigned = allocate(
    [...projects('a', 2), ...projects('empty', 1)],
    [{ id: 'one', trackIds: ['a', 'a'] }],
    3
  );
  expect(assigned).toEqual([
    { judgeId: 'one', submissionId: 'a-0' },
    { judgeId: 'one', submissionId: 'a-1' },
  ]);
});

it('redistributes the draft as each judge is added', () => {
  const submissions = projects('a', 12);
  const first = { id: 'first', trackIds: ['a'] };
  const second = { id: 'second', trackIds: ['a'] };
  expect(allocate(submissions, [first], 1)).toHaveLength(12);
  const next = allocate(submissions, [first, second], 1);
  expect(next.filter(item => item.judgeId === first.id)).toHaveLength(6);
  expect(next.filter(item => item.judgeId === second.id)).toHaveLength(6);
});

it('handles no projects or judges', () => {
  expect(allocate([], [], 3)).toEqual([]);
  expect(allocate(projects('a', 2), [], 3)).toEqual([]);
});

it.each([0, -1, 1.5, NaN, Infinity])(
  'rejects an invalid target: %s',
  target => {
    expect(() => allocate([], [], target)).toThrow('positive whole number');
  }
);

it('matches exhaustive optimal workloads across small overlapping track rosters', () => {
  const submissions = [...projects('a', 2), ...projects('b', 2)];
  for (let mask = 1; mask < 64; mask += 1) {
    const judges = Array.from({ length: 3 }, (_, i) => ({
      id: `j${i}`,
      trackIds: ['a', 'b'].filter((_, t) => mask & (1 << (i * 2 + t))),
    }));
    const choices = submissions.map(project =>
      judges
        .filter(judge => judge.trackIds.includes(project.trackId))
        .map(judge => judge.id)
    );
    if (choices.some(choice => choice.length === 0)) continue;
    const cost = (ids: string[]) => {
      const total = judges.reduce(
        (sum, judge) => sum + ids.filter(id => id === judge.id).length ** 2,
        0
      );
      const perTrack = judges.reduce(
        (sum, judge) =>
          sum +
          ['a', 'b'].reduce(
            (sub, track) =>
              sub +
              ids.filter(
                (id, i) => id === judge.id && submissions[i].trackId === track
              ).length **
                2,
            0
          ),
        0
      );
      return total * 17 + perTrack;
    };
    let best = Infinity;
    const enumerate = (ids: string[]) => {
      if (ids.length === submissions.length) {
        best = Math.min(best, cost(ids));
        return;
      }
      choices[ids.length].forEach(id => enumerate([...ids, id]));
    };
    enumerate([]);
    const assigned = allocate(submissions, judges, 1);
    expect(
      cost(
        submissions.map(
          project =>
            assigned.find(item => item.submissionId === project.id)!.judgeId
        )
      )
    ).toBe(best);
  }
});

describe('reassignJudgingAssignments', () => {
  it('gives released projects to the least-loaded eligible judges', () => {
    const result = reassign(
      [
        { id: 'p1', trackId: 'a' },
        { id: 'p2', trackId: 'a' },
      ],
      [
        { id: 'j1', trackIds: ['a'] },
        { id: 'j2', trackIds: ['a'] },
        { id: 'j3', trackIds: ['a'] },
      ],
      [
        { judgeId: 'j1', submissionId: 'p1' },
        { judgeId: 'j1', submissionId: 'p3' },
        { judgeId: 'j2', submissionId: 'p4' },
      ]
    );
    expect(result).toEqual({
      assignments: [
        { judgeId: 'j3', submissionId: 'p1' },
        { judgeId: 'j2', submissionId: 'p2' },
      ],
      uncovered: [],
    });
  });

  it('never doubles a judge on a project or crosses tracks', () => {
    const result = reassign(
      [
        { id: 'p1', trackId: 'a' },
        { id: 'p2', trackId: 'b' },
      ],
      [
        { id: 'j1', trackIds: ['a'] },
        { id: 'j2', trackIds: ['a'] },
      ],
      [
        { judgeId: 'j1', submissionId: 'p1' },
        { judgeId: 'j2', submissionId: 'p1' },
      ]
    );
    expect(result).toEqual({ assignments: [], uncovered: ['p1', 'p2'] });
  });

  it('serves the scarcest projects before flexible ones', () => {
    const result = reassign(
      [
        { id: 'p1', trackId: 'a' },
        { id: 'p2', trackId: 'b' },
      ],
      [
        { id: 'j1', trackIds: ['a', 'b'] },
        { id: 'j2', trackIds: ['a', 'b'] },
      ],
      [{ judgeId: 'j1', submissionId: 'p2' }]
    );
    expect(result.assignments).toEqual([
      { judgeId: 'j2', submissionId: 'p2' },
      { judgeId: 'j1', submissionId: 'p1' },
    ]);
  });
});

describe('pullJudgingAssignments', () => {
  const projects = Array.from({ length: 8 }, (_, index) => ({
    id: `p${index}`,
    trackId: 'a',
  }));
  const veteran = { id: 'vet', trackIds: ['a'] };
  const late = { id: 'late', trackIds: ['a'] };
  const queue = orderForJudge(
    veteran.id,
    projects.map(project => ({ submissionId: project.id }))
  ).map(item => item.submissionId);
  const owned = (done: number, started = done) =>
    queue.map((submissionId, index) => ({
      judgeId: veteran.id,
      submissionId,
      started: index < started,
      complete: index < done,
    }));
  const run = (assignments: ReturnType<typeof owned>, judgesPerProject = 1) =>
    pull({
      judge: late,
      judges: [veteran, late],
      projects,
      assignments,
      judgesPerProject,
      trackOrder: ['a'],
      minQueueDepth: 2,
    });

  it('evens out remaining work from the back of the busy queue', () => {
    const { added, moved } = run(owned(2));
    expect(added).toEqual([]);
    // 6 left for the veteran: hand over 3, taken from the end of their queue.
    expect(moved.map(item => item.submissionId)).toEqual([
      queue[7],
      queue[6],
      queue[5],
    ]);
    expect(moved.every(item => item.fromJudgeId === 'vet')).toBe(true);
  });

  it('never takes a started project or one of the next few in the queue', () => {
    // Seven opened but unfinished: only the unopened last one can move.
    const { moved } = run(owned(0, 7));
    expect(moved.map(item => item.submissionId)).toEqual([queue[7]]);
    const near = run(owned(5)).moved.map(item => item.submissionId);
    // 3 left: positions 5 and 6 are protected, so only 7 can move.
    expect(near).toEqual([queue[7]]);
  });

  it('fills under-covered projects before taking any work', () => {
    const { added, moved } = run(owned(8), 2);
    expect(added.map(item => item.submissionId).sort()).toEqual(
      projects.map(project => project.id)
    );
    expect(moved).toEqual([]);
  });

  it('only takes projects in its own tracks', () => {
    const result = pull({
      judge: { id: 'late', trackIds: ['b'] },
      judges: [veteran, { id: 'late', trackIds: ['b'] }],
      projects,
      assignments: owned(0),
      judgesPerProject: 1,
      trackOrder: ['a', 'b'],
      minQueueDepth: 2,
    });
    expect(result).toEqual({ added: [], moved: [] });
  });
});
