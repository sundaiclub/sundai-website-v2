import { listTodaysPublicEvents } from '@/lib/eventIdeas';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { event: { findMany: jest.fn() } },
}));

jest.mock('@/lib/eventManagementApi', () => ({
  getCurrentHacker: jest.fn(),
}));

const prisma = require('@/lib/prisma').default;

function event(
  id: string,
  startTime: string,
  endTime: string | null,
  timezone = 'America/New_York'
) {
  return {
    id,
    title: id,
    slug: id,
    startTime: new Date(startTime),
    endTime: endTime ? new Date(endTime) : null,
    timezone,
    publicLocation: null,
    image: null,
    chapter: { name: 'Sundai Boston', slug: 'boston' },
  };
}

describe('listTodaysPublicEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries public events in a window around now', async () => {
    prisma.event.findMany.mockResolvedValue([]);
    const now = new Date('2026-11-10T17:00:00.000Z');

    await listTodaysPublicEvents(now);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          startTime: { lt: new Date('2026-11-12T17:00:00.000Z') },
          OR: [
            { endTime: { gt: new Date('2026-11-08T17:00:00.000Z') } },
            {
              endTime: null,
              startTime: { gt: new Date('2026-11-08T17:00:00.000Z') },
            },
          ],
        }),
        orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
      })
    );
  });

  it('keeps events on today’s date in their own timezone', async () => {
    prisma.event.findMany.mockResolvedValue([
      // 10am–10pm Boston time today.
      event('today', '2026-11-10T15:00:00.000Z', '2026-11-11T03:00:00.000Z'),
      // Started yesterday and ends tomorrow.
      event(
        'multi-day',
        '2026-11-09T15:00:00.000Z',
        '2026-11-11T22:00:00.000Z'
      ),
      // No end time, starts later today.
      event('open-ended', '2026-11-10T23:00:00.000Z', null),
      event(
        'yesterday',
        '2026-11-09T15:00:00.000Z',
        '2026-11-09T22:00:00.000Z'
      ),
      event('tomorrow', '2026-11-11T15:00:00.000Z', '2026-11-11T22:00:00.000Z'),
    ]);

    const events = await listTodaysPublicEvents(
      new Date('2026-11-10T17:00:00.000Z')
    );

    expect(events.map(e => e.id)).toEqual(['today', 'multi-day', 'open-ended']);
    expect(events[0]).toMatchObject({
      chapterName: 'Sundai Boston',
      chapterSlug: 'boston',
    });
    expect(events[0]).not.toHaveProperty('chapter');
  });

  it('still lists a Boston evening event after midnight UTC', async () => {
    // 11:30pm Boston on Nov 10 is already Nov 11 in UTC.
    const now = new Date('2026-11-11T04:30:00.000Z');
    prisma.event.findMany.mockResolvedValue([
      event(
        'boston-night',
        '2026-11-10T23:00:00.000Z',
        '2026-11-11T04:59:00.000Z'
      ),
      event(
        'london-yesterday',
        '2026-11-10T18:00:00.000Z',
        '2026-11-10T22:00:00.000Z',
        'Europe/London'
      ),
    ]);

    const events = await listTodaysPublicEvents(now);

    expect(events.map(e => e.id)).toEqual(['boston-night']);
  });
});
