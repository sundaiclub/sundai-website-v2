import { TextEncoder } from 'util';
import prisma from '@/lib/prisma';
import {
  checkInEventRegistration,
  checkInQrImageUrl,
  checkInUrl,
  eventTicketUrl,
  hasCheckInWindowEnded,
  isCheckInToken,
  listEventCheckIns,
  loadRegistrationByCheckInToken,
  renderCheckInQrPng,
} from '@/lib/eventCheckIn';

jest.mock('@/lib/prisma', () => {
  const client = {
    eventRegistration: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    eventRegistrationAudit: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { __esModule: true, default: client };
});

const db = prisma as unknown as {
  eventRegistration: Record<string, jest.Mock>;
  eventRegistrationAudit: { create: jest.Mock };
  $transaction: jest.Mock;
};

// jsdom omits TextEncoder, which the QR encoder needs.
Object.assign(global, { TextEncoder });

const token = '7d4f3c2a-1b0e-4a9d-8c7b-6e5f4d3c2b1a';
const now = new Date('2026-07-18T18:00:00.000Z');
const registrationRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'registration-1',
  status: 'APPROVED',
  cancelledAt: null,
  checkedInAt: null,
  event: {
    trackAttendance: true,
    startTime: new Date('2026-07-18T14:00:00.000Z'),
    endTime: new Date('2026-07-18T22:00:00.000Z'),
  },
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  db.$transaction.mockImplementation(async arg =>
    typeof arg === 'function' ? arg(db) : Promise.all(arg)
  );
});

describe('check-in links', () => {
  it('builds QR, check-in, and ticket URLs from the app URL', () => {
    expect(checkInUrl(token, 'https://sundai.club/')).toBe(
      `https://sundai.club/check-in/${token}`
    );
    expect(checkInQrImageUrl(token, 'https://sundai.club')).toBe(
      `https://sundai.club/api/qr/check-in/${token}`
    );
    expect(checkInQrImageUrl(token, '')).toBe(`/api/qr/check-in/${token}`);
    expect(
      eventTicketUrl(
        { slug: 'ai-build-night', chapter: { slug: 'boston' } },
        'https://sundai.club'
      )
    ).toBe('https://sundai.club/events/boston/ai-build-night?tab=ticket');
  });

  it('only accepts UUID-shaped tokens', async () => {
    expect(isCheckInToken(token)).toBe(true);
    expect(isCheckInToken('../admin')).toBe(false);
    await expect(loadRegistrationByCheckInToken('nope')).resolves.toBeNull();
    expect(db.eventRegistration.findUnique).not.toHaveBeenCalled();
  });

  it('renders the QR code as a PNG', async () => {
    const png = await renderCheckInQrPng(token);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });
});

describe('hasCheckInWindowEnded', () => {
  const event = {
    startTime: new Date('2026-07-18T14:00:00.000Z'),
    endTime: new Date('2026-07-18T22:00:00.000Z'),
  };

  it('stays open before the event and for 24 hours after it ends', () => {
    expect(
      hasCheckInWindowEnded(event, new Date('2026-07-01T00:00:00.000Z'))
    ).toBe(false);
    expect(
      hasCheckInWindowEnded(event, new Date('2026-07-19T22:00:00.000Z'))
    ).toBe(false);
  });

  it('closes more than 24 hours after the end time', () => {
    expect(
      hasCheckInWindowEnded(event, new Date('2026-07-19T22:00:00.001Z'))
    ).toBe(true);
  });

  it('falls back to the start time when the event has no end time', () => {
    expect(
      hasCheckInWindowEnded(
        { ...event, endTime: null },
        new Date('2026-07-19T14:00:00.001Z')
      )
    ).toBe(true);
  });
});

describe('checkInEventRegistration', () => {
  const checkIn = () =>
    checkInEventRegistration({
      eventId: 'event-1',
      registrationId: 'registration-1',
      actorId: 'hacker-mc',
      now,
    });

  it('records the check-in time, organizer, and an audit entry', async () => {
    db.eventRegistration.findFirst.mockResolvedValue(registrationRecord());
    db.eventRegistration.updateMany.mockResolvedValue({ count: 1 });

    await expect(checkIn()).resolves.toEqual({
      ok: true,
      registration: {
        id: 'registration-1',
        checkedInAt: now,
        checkedInById: 'hacker-mc',
      },
    });
    expect(db.eventRegistration.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'registration-1',
        status: 'APPROVED',
        cancelledAt: null,
        checkedInAt: null,
      },
      data: { checkedInAt: now, checkedInById: 'hacker-mc' },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: 'registration-1',
        actorId: 'hacker-mc',
        changeJson: { action: 'CHECK_IN', checkedInAt: now.toISOString() },
      }),
    });
  });

  it.each([
    ['NOT_FOUND', null],
    [
      'TRACKING_DISABLED',
      registrationRecord({
        event: { ...registrationRecord().event, trackAttendance: false },
      }),
    ],
    [
      'EVENT_ENDED',
      registrationRecord({
        event: {
          trackAttendance: true,
          startTime: new Date('2026-07-10T14:00:00.000Z'),
          endTime: new Date('2026-07-10T22:00:00.000Z'),
        },
      }),
    ],
    ['NOT_APPROVED', registrationRecord({ status: 'WAITLISTED' })],
    ['NOT_APPROVED', registrationRecord({ cancelledAt: now })],
  ])('rejects with %s', async (reason, record) => {
    db.eventRegistration.findFirst.mockResolvedValue(record);

    await expect(checkIn()).resolves.toEqual({ ok: false, reason });
    expect(db.eventRegistration.updateMany).not.toHaveBeenCalled();
  });

  it('never overwrites an existing check-in', async () => {
    const checkedInAt = new Date('2026-07-18T15:00:00.000Z');
    db.eventRegistration.findFirst.mockResolvedValue(
      registrationRecord({ checkedInAt })
    );

    await expect(checkIn()).resolves.toEqual({
      ok: false,
      reason: 'ALREADY_CHECKED_IN',
      checkedInAt,
    });
    expect(db.eventRegistration.updateMany).not.toHaveBeenCalled();
  });

  it('reports a concurrent scan as already checked in', async () => {
    const checkedInAt = new Date('2026-07-18T17:59:59.000Z');
    db.eventRegistration.findFirst.mockResolvedValue(registrationRecord());
    db.eventRegistration.updateMany.mockResolvedValue({ count: 0 });
    db.eventRegistration.findUnique.mockResolvedValue({ checkedInAt });

    await expect(checkIn()).resolves.toEqual({
      ok: false,
      reason: 'ALREADY_CHECKED_IN',
      checkedInAt,
    });
    expect(db.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });
});

describe('listEventCheckIns', () => {
  it('counts and searches approved attendees, hiding banned users from non-admins', async () => {
    db.eventRegistration.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(12);
    db.eventRegistration.findMany.mockResolvedValue([
      {
        id: 'registration-1',
        hackerId: 'hacker-1',
        checkedInAt: now,
        checkedInBy: { name: 'Morgan MC' },
        hacker: { name: 'Ada', username: 'ada', email: 'ada@example.com' },
      },
    ]);

    const result = await listEventCheckIns({
      eventId: 'event-1',
      actor: { id: 'hacker-mc', role: null },
      search: ' ada ',
    });

    expect(result).toEqual({
      counts: { approved: 40, checkedIn: 12 },
      hasMore: false,
      rows: [
        {
          registrationId: 'registration-1',
          hackerId: 'hacker-1',
          name: 'Ada',
          username: 'ada',
          email: 'ada@example.com',
          checkedInAt: now.toISOString(),
          checkedInBy: 'Morgan MC',
        },
      ],
    });
    const where = db.eventRegistration.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      eventId: 'event-1',
      status: 'APPROVED',
      cancelledAt: null,
      hacker: { userBans: { none: { revokedAt: null } } },
    });
    expect(where.OR).toContainEqual({
      hacker: { name: { contains: 'ada', mode: 'insensitive' } },
    });
  });

  it('flags when more attendees match than the list shows', async () => {
    db.eventRegistration.count.mockResolvedValue(0);
    db.eventRegistration.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({
        id: `registration-${index}`,
        hackerId: `hacker-${index}`,
        checkedInAt: null,
        checkedInBy: null,
        hacker: { name: `Hacker ${index}`, username: null, email: null },
      }))
    );

    const result = await listEventCheckIns({
      eventId: 'event-1',
      actor: { id: 'hacker-admin', role: 'SITE_ADMIN' },
    });

    expect(result.hasMore).toBe(true);
    expect(result.rows).toHaveLength(50);
    expect(
      db.eventRegistration.findMany.mock.calls[0][0].where
    ).not.toHaveProperty('hacker');
  });
});
