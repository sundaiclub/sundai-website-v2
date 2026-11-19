import { loadRegistrationReviewQueue } from '../../src/lib/registrationReviewQueue';
import type { OrganizerRegistrationReviewCapabilities } from '../../src/types/event-management';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

const eventId = 'event-review-queue';

const mcCapabilities: OrganizerRegistrationReviewCapabilities = {
  canView: true,
  canDecide: true,
  canApprove: true,
  canWaitlist: true,
  canDecline: true,
  canCancel: true,
  canEditInternalNotes: true,
  canViewBanContext: false,
};

function buildRecord(id: string, hackerId = `hacker-${id}`) {
  return {
    id,
    eventId,
    hackerId,
    status: 'PENDING',
    source: 'WEBSITE',
    answersJson: { why: 'Fake answer for tests.' },
    templateSnapshotJson: null,
    publicSafeMessage: null,
    internalReviewNotes: null,
    submittedAt: new Date('2026-06-22T16:00:00.000Z'),
    decidedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-06-22T16:00:00.000Z'),
    hacker: {
      id: hackerId,
      name: `Applicant ${id}`,
      username: null,
      email: `${id}@example.test`,
      role: 'HACKER',
      organizerNote: null,
      userBans: [
        {
          id: `ban-${id}`,
          publicSafeReason: 'Fake ban reason.',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    },
    decidedBy: null,
    cancelledBy: null,
  };
}

function createDb(records = [buildRecord('one')]) {
  return {
    event: {
      findUnique: jest.fn().mockResolvedValue({ capacity: 40 }),
    },
    eventRegistration: {
      findMany: jest.fn().mockResolvedValue(records),
      groupBy: jest.fn(async ({ by }: { by: string[] }) =>
        by.includes('hackerId')
          ? []
          : [
              { status: 'PENDING', _count: { _all: 3 } },
              { status: 'APPROVED', _count: { _all: 12 } },
            ]
      ),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function baseInput() {
  return {
    eventId,
    status: 'PENDING' as const,
    hideBannedUsers: true,
    order: 'oldest' as const,
    take: 50,
    skip: 0,
    capabilities: mcCapabilities,
  };
}

describe('loadRegistrationReviewQueue', () => {
  it('filters banned applicants in the list and the counts with one query each', async () => {
    const db = createDb();

    const page = await loadRegistrationReviewQueue(baseInput(), db as never);

    const banExclusion = { userBans: { none: { revokedAt: null } } };
    expect(db.eventRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId, hacker: banExclusion, status: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 51,
        skip: 0,
      })
    );
    expect(db.eventRegistration.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: { eventId, hacker: banExclusion },
      })
    );
    expect(page.counts).toEqual({ PENDING: 3, APPROVED: 12 });
    expect(page.capacity).toBe(40);
    expect(page.hasMore).toBe(false);
  });

  it('includes banned applicants only when asked to', async () => {
    const db = createDb();

    await loadRegistrationReviewQueue(
      { ...baseInput(), hideBannedUsers: false },
      db as never
    );

    expect(db.eventRegistration.findMany.mock.calls[0][0].where).toEqual({
      eventId,
      status: 'PENDING',
    });
    expect(
      db.eventRegistration.groupBy.mock.calls.find(
        ([args]: [{ by: string[] }]) => args.by.length === 1
      )[0].where
    ).toEqual({ eventId });
  });

  it('searches applicant name, email, and username and sorts newest first', async () => {
    const db = createDb();

    await loadRegistrationReviewQueue(
      { ...baseInput(), search: '  ada ', order: 'newest' },
      db as never
    );

    const args = db.eventRegistration.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { hacker: { name: { contains: 'ada', mode: 'insensitive' } } },
      { hacker: { email: { contains: 'ada', mode: 'insensitive' } } },
      { hacker: { username: { contains: 'ada', mode: 'insensitive' } } },
    ]);
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('reports another page when the query returns more rows than requested', async () => {
    const db = createDb([buildRecord('one'), buildRecord('two')]);

    const page = await loadRegistrationReviewQueue(
      { ...baseInput(), take: 1 },
      db as never
    );

    expect(page.hasMore).toBe(true);
    expect(page.rows.map(row => row.id)).toEqual(['one']);
  });

  it('returns ban context only to viewers who can see it', async () => {
    const db = createDb();

    const organizerPage = await loadRegistrationReviewQueue(
      baseInput(),
      db as never
    );
    const adminPage = await loadRegistrationReviewQueue(
      {
        ...baseInput(),
        capabilities: { ...mcCapabilities, canViewBanContext: true },
      },
      db as never
    );

    expect(organizerPage.rows[0].activeBan).toBeNull();
    expect(JSON.stringify(organizerPage.rows)).not.toContain(
      'Fake ban reason.'
    );
    expect(adminPage.rows[0].activeBan).toEqual(
      expect.objectContaining({ publicSafeReason: 'Fake ban reason.' })
    );
  });
});
