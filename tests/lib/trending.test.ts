import { calculateTrendingScore } from '../../src/lib/trending';

describe('calculateTrendingScore', () => {
  it('returns raw likes when decay is not provided', () => {
    const score = calculateTrendingScore({
      likes: [{ hackerId: 'a' }, { hackerId: 'b' }],
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(score).toBe(2);
  });

  it('avoids numeric underflow for old projects when using decay', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-12T00:00:00.000Z'));

    try {
      const olderWithMoreLikes = calculateTrendingScore(
        {
          likes: [{ hackerId: 'a' }, { hackerId: 'b' }],
          startDate: '2024-01-01T00:00:00.000Z',
        },
        { timeDecayDays: 1 }
      );

      const newerWithFewerLikes = calculateTrendingScore(
        {
          likes: [{ hackerId: 'a' }],
          startDate: '2024-01-03T00:00:00.000Z',
        },
        { timeDecayDays: 1 }
      );

      expect(Number.isFinite(olderWithMoreLikes)).toBe(true);
      expect(Number.isFinite(newerWithFewerLikes)).toBe(true);
      expect(newerWithFewerLikes).toBeGreaterThan(olderWithMoreLikes);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to log-likes when date is invalid', () => {
    const withLikes = calculateTrendingScore(
      {
        likes: [{ hackerId: 'a' }],
        startDate: 'invalid-date',
      },
      { timeDecayDays: 1 }
    );

    const withoutLikes = calculateTrendingScore(
      {
        likes: [],
        startDate: 'invalid-date',
      },
      { timeDecayDays: 1 }
    );

    expect(withLikes).toBeGreaterThan(withoutLikes);
  });
});
