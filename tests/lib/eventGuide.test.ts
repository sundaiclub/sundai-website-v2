const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

import { guideEmbedUrl, listViewerGuideEvents } from '../../src/lib/eventGuide';

describe('guideEmbedUrl', () => {
  it.each([
    'https://docs.google.com/presentation/d/fake-deck_1/edit?usp=sharing',
    'https://docs.google.com/presentation/d/fake-deck_1/edit#slide=id.p',
    'https://docs.google.com/presentation/d/fake-deck_1/',
    'https://docs.google.com/presentation/d/fake-deck_1/embed',
  ])('embeds the Google Slides link %s', url => {
    expect(guideEmbedUrl(url)).toBe(
      'https://docs.google.com/presentation/d/fake-deck_1/embed?start=false&loop=false&delayms=3000'
    );
  });

  it('embeds a published Google Slides link', () => {
    expect(
      guideEmbedUrl('https://docs.google.com/presentation/d/e/2PACX-fake/pub')
    ).toBe(
      'https://docs.google.com/presentation/d/e/2PACX-fake/embed?start=false&loop=false&delayms=3000'
    );
  });

  it('keeps other links as they are', () => {
    expect(guideEmbedUrl('https://example.com/guide?page=2')).toBe(
      'https://example.com/guide?page=2'
    );
  });
});

describe('listViewerGuideEvents', () => {
  const now = new Date('2026-11-22T17:00:00.000Z');
  const event = (overrides: Record<string, unknown>) => ({
    id: 'event-1',
    title: 'Build Night',
    slug: 'build-night',
    startTime: new Date('2026-11-22T15:00:00.000Z'),
    endTime: new Date('2026-11-23T02:00:00.000Z'),
    timezone: 'America/New_York',
    publicLocation: 'MIT',
    image: null,
    chapter: { name: 'Sundai Boston', slug: 'boston' },
    ...overrides,
  });

  beforeEach(() => mockFindMany.mockReset());

  it('limits members to guides they can open and leaves out the guide link', async () => {
    mockFindMany.mockResolvedValue([event({})]);

    const events = await listViewerGuideEvents(
      { id: 'hacker-1', role: 'HACKER' },
      now
    );

    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.guideUrl).toEqual({ not: null });
    expect(args.where.status).toBe('PUBLISHED');
    expect(args.where.AND.OR).toEqual([
      {
        registrations: {
          some: { hackerId: 'hacker-1', status: 'APPROVED', cancelledAt: null },
        },
      },
      {
        staff: {
          some: { hackerId: 'hacker-1', role: { in: ['MC', 'CO_MC'] } },
        },
      },
      {
        chapter: {
          memberships: {
            some: { hackerId: 'hacker-1', role: 'ADMIN', status: 'ACTIVE' },
          },
        },
      },
    ]);
    expect(args.select).not.toHaveProperty('guideUrl');
    expect(events).toEqual([
      expect.objectContaining({ id: 'event-1', chapterSlug: 'boston' }),
    ]);
  });

  it('lists every guide for site admins', async () => {
    mockFindMany.mockResolvedValue([]);

    await listViewerGuideEvents({ id: 'admin-1', role: 'SITE_ADMIN' }, now);

    expect(mockFindMany.mock.calls[0][0].where).not.toHaveProperty('AND');
  });

  it('drops events that ended before today in their timezone', async () => {
    mockFindMany.mockResolvedValue([
      event({
        id: 'yesterday',
        startTime: new Date('2026-11-21T15:00:00.000Z'),
        endTime: new Date('2026-11-22T03:00:00.000Z'),
      }),
      event({ id: 'today' }),
      event({
        id: 'next-week',
        startTime: new Date('2026-11-29T15:00:00.000Z'),
        endTime: null,
      }),
    ]);

    const events = await listViewerGuideEvents(
      { id: 'hacker-1', role: 'HACKER' },
      now
    );

    expect(events.map(item => item.id)).toEqual(['today', 'next-week']);
  });
});
