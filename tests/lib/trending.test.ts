import { calculateTrendingScore } from '../../src/lib/trending';

describe('calculateTrendingScore', () => {
  it('returns raw likes when decay is not provided', () => {
    const score = calculateTrendingScore({
      likes: [
        { hackerId: 'a', createdAt: '2026-04-10T00:00:00.000Z' },
        { hackerId: 'b', createdAt: '2026-04-11T00:00:00.000Z' },
      ],
    });

    expect(score).toBe(2);
  });

  it('favors fresh likes on older projects over stale likes on newer ones', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    try {
      const olderProjectWithFreshLikes = calculateTrendingScore(
        {
          likes: [
            { hackerId: 'a', createdAt: '2026-04-13T00:00:00.000Z' },
            { hackerId: 'b', createdAt: '2026-04-14T00:00:00.000Z' },
          ],
        },
        { timeDecayDays: 7 }
      );

      const newerProjectWithStaleLikes = calculateTrendingScore(
        {
          likes: [
            { hackerId: 'a', createdAt: '2026-03-01T00:00:00.000Z' },
            { hackerId: 'b', createdAt: '2026-03-02T00:00:00.000Z' },
            { hackerId: 'c', createdAt: '2026-03-03T00:00:00.000Z' },
          ],
        },
        { timeDecayDays: 7 }
      );

      expect(olderProjectWithFreshLikes).toBeGreaterThan(newerProjectWithStaleLikes);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores age of the project itself when likes are recent', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    try {
      const oneFreshLike = calculateTrendingScore(
        {
          likes: [{ hackerId: 'a', createdAt: '2026-04-14T00:00:00.000Z' }],
        },
        { timeDecayDays: 30 }
      );

      const oneOldLike = calculateTrendingScore(
        {
          likes: [{ hackerId: 'a', createdAt: '2025-10-14T00:00:00.000Z' }],
        },
        { timeDecayDays: 30 }
      );

      expect(oneFreshLike).toBeGreaterThan(oneOldLike);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to counting likes when like timestamps are invalid', () => {
    const withLikes = calculateTrendingScore(
      {
        likes: [{ hackerId: 'a', createdAt: 'invalid-date' }],
      },
      { timeDecayDays: 7 }
    );

    const withoutLikes = calculateTrendingScore(
      {
        likes: [],
      },
      { timeDecayDays: 7 }
    );

    expect(withLikes).toBeGreaterThan(withoutLikes);
  });
});
