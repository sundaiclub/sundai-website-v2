import { allocateJudgingAssignments as allocate } from '@/lib/judgingAssignments';

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
