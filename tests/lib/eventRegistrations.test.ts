import { fetchMergedApplicationTemplate } from '@/lib/applicationTemplateQueries';
import {
  autoPromoteWaitlistAfterApprovedCancellation,
  cancelPublicEventRegistration,
  countApprovedEventRegistrations,
  findOldestWaitlistedEventRegistration,
  hasApprovedRegistrationCapacity,
  listEventRegistrations,
  updatePendingPublicEventRegistration,
} from '../../src/lib/eventRegistrations';
import type {
  EventRegistration,
  TemplateFieldDefinition,
} from '../../src/types/event-management';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/lib/applicationTemplateQueries', () => ({
  fetchMergedApplicationTemplate: jest.fn(),
}));

jest.mock('@/lib/eventDecisionNotifications', () => ({
  notifyEventDecision: jest.fn().mockResolvedValue({
    email: 'sent',
    sms: 'sent',
  }),
}));

const {
  notifyEventDecision,
} = require('../../src/lib/eventDecisionNotifications');

const eventId = 'event-native-rsvp';
const now = () => new Date('2026-06-23T14:00:00.000Z');

const siteFields: TemplateFieldDefinition[] = [
  {
    id: 'name',
    label: 'Name',
    type: 'TEXT',
    required: true,
    siteRequired: true,
    order: 0,
  },
];

const buildRegistration = (
  overrides: Partial<EventRegistration> = {}
): EventRegistration => ({
  id: 'registration-1',
  eventId,
  hackerId: 'hacker-applicant',
  status: 'PENDING',
  source: 'WEBSITE',
  answersJson: null,
  templateSnapshotJson: null,
  publicSafeMessage: null,
  internalReviewNotes: null,
  decidedById: null,
  decidedAt: null,
  submittedAt: now(),
  cancelledAt: null,
  cancelledById: null,
  waitlistedAt: null,
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const createRegistrationDb = () => {
  const db = {
    event: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    eventRegistration: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    eventRegistrationAudit: {
      create: jest.fn(),
    },
    applicationTemplate: {
      findFirst: jest.fn(),
    },
    userBan: {
      findMany: jest.fn(),
    },
    hacker: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  db.$transaction.mockImplementation(async callback => callback(db));

  return db;
};

describe('event registration capacity helpers', () => {
  it('counts active approved registrations and treats nullable capacity as unlimited', async () => {
    const db = createRegistrationDb();
    db.eventRegistration.count.mockResolvedValue(2);

    await expect(countApprovedEventRegistrations(eventId, db)).resolves.toBe(2);

    expect(db.eventRegistration.count).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'APPROVED',
        cancelledAt: null,
      },
    });
    expect(hasApprovedRegistrationCapacity(null, 100)).toBe(true);
    expect(hasApprovedRegistrationCapacity(3, 2)).toBe(true);
    expect(hasApprovedRegistrationCapacity(3, 3)).toBe(false);
    expect(hasApprovedRegistrationCapacity(0, 0)).toBe(false);
  });

  it('falls back to findMany when count is not available on the provided client', async () => {
    const db = createRegistrationDb();
    const dbWithoutCount = {
      ...db,
      eventRegistration: {
        ...db.eventRegistration,
        count: undefined,
      },
    };
    dbWithoutCount.eventRegistration.findMany.mockResolvedValue([
      { id: 'registration-approved-1' },
      { id: 'registration-approved-2' },
    ]);

    await expect(
      countApprovedEventRegistrations(eventId, dbWithoutCount)
    ).resolves.toBe(2);

    expect(dbWithoutCount.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'APPROVED',
        cancelledAt: null,
      },
      select: { id: true },
    });
  });
});

describe('event registration waitlist helpers', () => {
  it('selects the oldest waitlisted registration by waitlisted timestamp before creation order', async () => {
    const db = createRegistrationDb();
    const newest = buildRegistration({
      id: 'registration-newest',
      status: 'WAITLISTED',
      waitlistedAt: new Date('2026-06-23T10:00:00.000Z'),
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
    });
    const oldest = buildRegistration({
      id: 'registration-oldest',
      status: 'WAITLISTED',
      waitlistedAt: new Date('2026-06-22T10:00:00.000Z'),
      createdAt: new Date('2026-06-22T10:00:00.000Z'),
    });
    const fallbackOrdered = buildRegistration({
      id: 'registration-created-first',
      status: 'WAITLISTED',
      waitlistedAt: null,
      submittedAt: new Date('2026-06-21T10:00:00.000Z'),
      createdAt: new Date('2026-06-21T10:00:00.000Z'),
    });
    db.eventRegistration.findMany.mockResolvedValue([
      newest,
      oldest,
      fallbackOrdered,
    ]);

    await expect(
      findOldestWaitlistedEventRegistration(eventId, db)
    ).resolves.toBe(fallbackOrdered);

    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'WAITLISTED',
        cancelledAt: null,
      },
      orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }],
    });
  });
});

describe('event registration review query helpers', () => {
  it('uses event and status filters with stable review ordering and pagination', async () => {
    const db = createRegistrationDb();
    db.eventRegistration.findMany.mockResolvedValue([]);

    await expect(
      listEventRegistrations(
        eventId,
        false,
        { status: 'WAITLISTED', take: 25, skip: 50 },
        db
      )
    ).resolves.toEqual([]);

    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'WAITLISTED',
      },
      include: expect.objectContaining({ hacker: expect.any(Object) }),
      orderBy: { createdAt: 'desc' },
      take: 25,
      skip: 50,
    });
    expect(db.userBan.findMany).not.toHaveBeenCalled();
  });

  it('filters active bans from non-site-admin review lists with a deduped ban lookup', async () => {
    const db = createRegistrationDb();
    const visibleRegistration = buildRegistration({
      id: 'registration-visible',
      hackerId: 'hacker-visible',
    });
    const duplicateVisibleRegistration = buildRegistration({
      id: 'registration-visible-older',
      hackerId: 'hacker-visible',
    });
    const bannedRegistration = buildRegistration({
      id: 'registration-banned',
      hackerId: 'hacker-banned',
    });
    db.eventRegistration.findMany.mockResolvedValue([
      bannedRegistration,
      visibleRegistration,
      duplicateVisibleRegistration,
    ]);
    db.userBan.findMany.mockResolvedValue([{ hackerId: 'hacker-banned' }]);

    await expect(
      listEventRegistrations(eventId, false, { status: 'PENDING' }, db)
    ).resolves.toEqual([visibleRegistration, duplicateVisibleRegistration]);

    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'PENDING',
      },
      include: expect.objectContaining({ hacker: expect.any(Object) }),
      orderBy: { createdAt: 'desc' },
      take: undefined,
      skip: undefined,
    });
    expect(db.userBan.findMany).toHaveBeenCalledWith({
      where: {
        hackerId: { in: ['hacker-banned', 'hacker-visible'] },
        revokedAt: null,
      },
      select: { hackerId: true },
    });
  });

  it('does not perform ban filtering for site-admin review lists', async () => {
    const db = createRegistrationDb();
    const registrations = [
      buildRegistration({ id: 'registration-visible' }),
      buildRegistration({
        id: 'registration-banned',
        hackerId: 'hacker-banned',
      }),
    ];
    db.eventRegistration.findMany.mockResolvedValue(registrations);

    await expect(
      listEventRegistrations(eventId, true, { status: 'BLOCKED' }, db)
    ).resolves.toEqual(registrations);

    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'BLOCKED',
      },
      include: expect.objectContaining({ hacker: expect.any(Object) }),
      orderBy: { createdAt: 'desc' },
      take: undefined,
      skip: undefined,
    });
    expect(db.userBan.findMany).not.toHaveBeenCalled();
  });
});

describe('event registration auto-promotion helpers', () => {
  it('promotes the oldest waitlisted registration inside a serializable transaction', async () => {
    const db = createRegistrationDb();
    const waitlistedRegistration = buildRegistration({
      id: 'registration-waitlisted',
      status: 'WAITLISTED',
      waitlistedAt: new Date('2026-06-22T10:00:00.000Z'),
    });
    const promotedRegistration = buildRegistration({
      ...waitlistedRegistration,
      status: 'APPROVED',
      decidedById: 'hacker-canceller',
      decidedAt: now(),
      publicSafeMessage: null,
    });
    db.event.findUnique.mockResolvedValue({
      id: eventId,
      capacity: 2,
      autoPromoteWaitlist: true,
    });
    db.eventRegistration.count.mockResolvedValue(1);
    db.eventRegistration.findMany.mockResolvedValue([waitlistedRegistration]);
    db.eventRegistration.update.mockResolvedValue(promotedRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-promotion',
      registrationId: promotedRegistration.id,
      eventId,
      actorId: 'hacker-canceller',
      fromStatus: 'WAITLISTED',
      toStatus: 'APPROVED',
      changeJson: {},
      createdAt: now(),
    });

    await expect(
      autoPromoteWaitlistAfterApprovedCancellation(
        {
          eventId,
          triggeringRegistrationId: 'registration-cancelled',
          actorId: 'hacker-canceller',
        },
        db
      )
    ).resolves.toEqual({
      promoted: true,
      registration: promotedRegistration,
      approvedCountBeforePromotion: 1,
      capacity: 2,
    });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.event.findUnique).toHaveBeenCalledWith({
      where: { id: eventId },
      select: {
        id: true,
        capacity: true,
        autoPromoteWaitlist: true,
      },
    });
    expect(db.eventRegistration.count).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'APPROVED',
        cancelledAt: null,
      },
    });
    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId,
        status: 'WAITLISTED',
        cancelledAt: null,
      },
      orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(db.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: waitlistedRegistration.id },
      data: {
        status: 'APPROVED',
        decidedById: 'hacker-canceller',
        decidedAt: expect.any(Date),
        publicSafeMessage: null,
      },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: promotedRegistration.id,
        eventId,
        actorId: 'hacker-canceller',
        fromStatus: 'WAITLISTED',
        toStatus: 'APPROVED',
        changeJson: {
          action: 'AUTO_PROMOTE_WAITLISTED_REGISTRATION',
          automatic: true,
          triggeringRegistrationId: 'registration-cancelled',
          approvedCountBeforePromotion: 1,
          capacity: 2,
        },
      },
    });
  });
});

describe('public registration cancellation helpers', () => {
  it('writes cancellation fields and a public cancellation audit entry', async () => {
    const db = createRegistrationDb();
    const existingRegistration = buildRegistration({
      id: 'registration-cancel-me',
      hackerId: 'hacker-cancel-me',
      status: 'WAITLISTED',
    });
    const cancelledRegistration = buildRegistration({
      ...existingRegistration,
      status: 'CANCELLED',
      cancelledAt: now(),
      cancelledById: 'hacker-cancel-me',
    });
    db.eventRegistration.findFirst.mockResolvedValue(existingRegistration);
    db.eventRegistration.update.mockResolvedValue(cancelledRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-cancelled',
      registrationId: existingRegistration.id,
      eventId,
      actorId: 'hacker-cancel-me',
      fromStatus: 'WAITLISTED',
      toStatus: 'CANCELLED',
      changeJson: {},
      createdAt: now(),
    });

    await expect(
      cancelPublicEventRegistration(
        {
          eventId,
          hackerId: 'hacker-cancel-me',
        },
        db
      )
    ).resolves.toEqual({
      ok: true,
      registration: {
        id: cancelledRegistration.id,
        status: 'CANCELLED',
        submittedAt: cancelledRegistration.submittedAt,
        publicSafeMessage: null,
      },
    });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: existingRegistration.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: expect.any(Date),
        cancelledById: 'hacker-cancel-me',
      },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: existingRegistration.id,
        eventId,
        actorId: 'hacker-cancel-me',
        fromStatus: 'WAITLISTED',
        toStatus: 'CANCELLED',
        changeJson: {
          action: 'CANCEL_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
          cancelledBySelf: true,
        },
      },
    });
  });

  it('notifies an applicant who is approved by automatic promotion', async () => {
    jest.mocked(notifyEventDecision).mockClear();
    const db = createRegistrationDb();
    const approvedRegistration = buildRegistration({
      id: 'registration-approved-cancel-me',
      hackerId: 'hacker-cancel-me',
      status: 'APPROVED',
    });
    const cancelledRegistration = buildRegistration({
      ...approvedRegistration,
      status: 'CANCELLED',
      cancelledAt: now(),
      cancelledById: 'hacker-cancel-me',
    });
    const waitlistedRegistration = buildRegistration({
      id: 'registration-waitlisted-promote',
      hackerId: 'hacker-promoted',
      status: 'WAITLISTED',
      waitlistedAt: now(),
    });
    const promotedRegistration = buildRegistration({
      ...waitlistedRegistration,
      status: 'APPROVED',
      decidedById: 'hacker-cancel-me',
      decidedAt: now(),
    });

    db.eventRegistration.findFirst.mockResolvedValue(approvedRegistration);
    db.eventRegistration.update.mockImplementation(async ({ data }) =>
      data.status === 'APPROVED' ? promotedRegistration : cancelledRegistration
    );
    db.eventRegistration.findMany.mockResolvedValue([waitlistedRegistration]);
    db.eventRegistration.count.mockResolvedValue(0);
    db.event.findUnique.mockResolvedValue({
      id: eventId,
      capacity: 1,
      autoPromoteWaitlist: true,
    });
    db.eventRegistrationAudit.create.mockResolvedValue({});

    await cancelPublicEventRegistration(
      { eventId, hackerId: approvedRegistration.hackerId },
      db
    );

    expect(notifyEventDecision).toHaveBeenCalledWith({
      eventId,
      registrationId: promotedRegistration.id,
      status: 'APPROVED',
    });
  });
});

describe('public registration edit helpers', () => {
  beforeEach(() => {
    jest.mocked(fetchMergedApplicationTemplate).mockResolvedValue({
      siteTemplateId: 'template-site',
      chapterTemplateId: null,
      eventId,
      fields: siteFields,
    });
  });

  it('preserves submittedAt while updating pending application answers', async () => {
    const db = createRegistrationDb();
    const submittedAt = new Date('2026-06-22T09:00:00.000Z');
    const existingRegistration = buildRegistration({
      id: 'registration-edit',
      hackerId: 'hacker-editor',
      submittedAt,
      answersJson: { name: 'Original Name' },
    });
    const updatedRegistration = buildRegistration({
      ...existingRegistration,
      answersJson: { name: 'Updated Name' },
      updatedAt: new Date('2026-06-23T09:00:00.000Z'),
    });
    db.eventRegistration.findFirst.mockResolvedValue(existingRegistration);
    db.eventRegistration.update.mockResolvedValue(updatedRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-edit',
      registrationId: existingRegistration.id,
      eventId,
      actorId: 'hacker-editor',
      fromStatus: 'PENDING',
      toStatus: 'PENDING',
      changeJson: {},
      createdAt: now(),
    });

    await expect(
      updatePendingPublicEventRegistration(
        {
          eventId,
          hackerId: 'hacker-editor',
          answersJson: {
            name: 'Updated Name',
            phoneNumber: '+15551234567',
          },
          smsConsentGranted: true,
        },
        db
      )
    ).resolves.toEqual({
      ok: true,
      registration: {
        id: updatedRegistration.id,
        status: 'PENDING',
        submittedAt,
        publicSafeMessage: null,
      },
    });

    expect(db.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: existingRegistration.id },
      data: {
        answersJson: {
          name: 'Updated Name',
          phoneNumber: '+15551234567',
        },
        templateSnapshotJson: siteFields,
      },
    });
    expect(db.hacker.update).toHaveBeenCalledWith({
      where: { id: 'hacker-editor' },
      data: {
        name: 'Updated Name',
        phoneNumber: '+15551234567',
        smsConsentAt: expect.any(Date),
        smsConsentVersion: 'site-application-checkbox-2026-08-04',
      },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: existingRegistration.id,
        eventId,
        actorId: 'hacker-editor',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        changeJson: {
          action: 'EDIT_PUBLIC_REGISTRATION_ANSWERS',
          source: 'WEBSITE',
          submittedAtPreserved: true,
        },
      },
    });
  });
});
