const mockFindUnique = jest.fn();
const mockRedirect = jest.fn();
const mockNotFound = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  notFound: (...args: unknown[]) => mockNotFound(...args),
}));

import LegacyPitchEventPage from '@/app/pitch/[eventId]/page';

describe('/pitch/[eventId] compatibility redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('redirects an existing pitch link to the event Pitch tab', async () => {
    mockFindUnique.mockResolvedValue({
      slug: 'ai-build-night',
      chapter: { slug: 'boston' },
    });

    await LegacyPitchEventPage({ params: { eventId: 'event-1' } });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      select: {
        slug: true,
        chapter: { select: { slug: true } },
      },
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      '/events/boston/ai-build-night?tab=pitch'
    );
  });

  it('returns not found for an unknown event ID', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      LegacyPitchEventPage({ params: { eventId: 'missing' } })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
