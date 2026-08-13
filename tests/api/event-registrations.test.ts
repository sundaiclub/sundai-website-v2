import {
  canManageRegistrationStatus,
  createInternalEventRegistration,
  getRegistrationStatusGuard,
  listEventRegistrations,
  updateEventRegistrationStatus,
} from '../../src/lib/eventRegistrations';
import { Prisma } from '@prisma/client';
import type { EventRegistration } from '../../src/types/event-management';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    eventRegistration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventRegistrationAudit: {
      create: jest.fn(),
    },
    userBan: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const now = () => new Date('2026-05-25T12:00:00.000Z');

const buildRegistration = (
  overrides: Partial<EventRegistration> = {}
): EventRegistration => ({
  id: 'registration-1',
  eventId: 'event-boston-demo-night',
  hackerId: 'hacker-applicant',
  status: 'PENDING',
  source: 'INTERNAL',
  answersJson: null,
  templateSnapshotJson: null,
  publicSafeMessage: null,
  internalReviewNotes: null,
  decidedById: null,
  decidedAt: null,
  createdAt: now(),
  updatedAt: now(),
  ...overrides,
});

const createRegistrationDb = () => {
  const db = {
    eventRegistration: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventRegistrationAudit: {
      create: jest.fn(),
    },
    userBan: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  db.$transaction.mockImplementation(async callback => callback(db));

  return db;
};

describe('/api/events/[eventId]/registrations internals', () => {
  it('creates internal registrations with default pending status and an audit record', async () => {
    const db = createRegistrationDb();
    const createdRegistration = buildRegistration();
    db.eventRegistration.create.mockResolvedValue(createdRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-1',
      registrationId: createdRegistration.id,
      eventId: createdRegistration.eventId,
      actorId: 'hacker-mc',
      fromStatus: null,
      toStatus: 'PENDING',
      changeJson: { action: 'CREATE_INTERNAL_REGISTRATION' },
      createdAt: now(),
    });

    await expect(
      createInternalEventRegistration(
        {
          eventId: createdRegistration.eventId,
          hackerId: createdRegistration.hackerId,
          actorId: 'hacker-mc',
        },
        db
      )
    ).resolves.toBe(createdRegistration);

    expect(db.eventRegistration.create).toHaveBeenCalledWith({
      data: {
        eventId: createdRegistration.eventId,
        hackerId: createdRegistration.hackerId,
        status: 'PENDING',
        source: 'INTERNAL',
        answersJson: Prisma.DbNull,
        templateSnapshotJson: Prisma.DbNull,
        publicSafeMessage: null,
        internalReviewNotes: null,
        decidedById: null,
        decidedAt: null,
      },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: createdRegistration.id,
        eventId: createdRegistration.eventId,
        actorId: 'hacker-mc',
        fromStatus: null,
        toStatus: 'PENDING',
        changeJson: {
          action: 'CREATE_INTERNAL_REGISTRATION',
          source: 'INTERNAL',
        },
      },
    });
  });

  it('records actor decision metadata when an internal registration is created as approved', async () => {
    const db = createRegistrationDb();
    const createdRegistration = buildRegistration({
      status: 'APPROVED',
      decidedById: 'hacker-chapter-admin',
      decidedAt: now(),
    });
    db.eventRegistration.create.mockResolvedValue(createdRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-approved',
      registrationId: createdRegistration.id,
      eventId: createdRegistration.eventId,
      actorId: 'hacker-chapter-admin',
      fromStatus: null,
      toStatus: 'APPROVED',
      changeJson: { action: 'CREATE_INTERNAL_REGISTRATION' },
      createdAt: now(),
    });

    await createInternalEventRegistration(
      {
        eventId: createdRegistration.eventId,
        hackerId: createdRegistration.hackerId,
        actorId: 'hacker-chapter-admin',
        status: 'APPROVED',
      },
      db
    );

    expect(db.eventRegistration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'APPROVED',
        decidedById: 'hacker-chapter-admin',
        decidedAt: expect.any(Date),
      }),
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: null,
        toStatus: 'APPROVED',
      }),
    });
  });

  it('updates registration status and writes an audit record with status transition details', async () => {
    const db = createRegistrationDb();
    const existingRegistration = buildRegistration({
      id: 'registration-status-update',
      status: 'PENDING',
      publicSafeMessage: null,
      internalReviewNotes: 'Needs review',
    });
    const updatedRegistration = buildRegistration({
      ...existingRegistration,
      status: 'APPROVED',
      publicSafeMessage: 'Approved for demo night.',
      internalReviewNotes: 'Reviewed by MC',
      decidedById: 'hacker-mc',
      decidedAt: now(),
    });
    db.eventRegistration.findFirst.mockResolvedValue(existingRegistration);
    db.eventRegistration.update.mockResolvedValue(updatedRegistration);
    db.eventRegistrationAudit.create.mockResolvedValue({
      id: 'registration-audit-status',
      registrationId: existingRegistration.id,
      eventId: existingRegistration.eventId,
      actorId: 'hacker-mc',
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      changeJson: { action: 'UPDATE_REGISTRATION_STATUS' },
      createdAt: now(),
    });

    await expect(
      updateEventRegistrationStatus(
        {
          registrationId: existingRegistration.id,
          eventId: existingRegistration.eventId,
          actorId: 'hacker-mc',
          toStatus: 'APPROVED',
          publicSafeMessage: 'Approved for demo night.',
          internalReviewNotes: 'Reviewed by MC',
        },
        db
      )
    ).resolves.toBe(updatedRegistration);

    expect(db.eventRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        id: existingRegistration.id,
        eventId: existingRegistration.eventId,
      },
    });
    expect(db.eventRegistration.update).toHaveBeenCalledWith({
      where: { id: existingRegistration.id },
      data: {
        status: 'APPROVED',
        publicSafeMessage: 'Approved for demo night.',
        internalReviewNotes: 'Reviewed by MC',
        decidedById: 'hacker-mc',
        decidedAt: expect.any(Date),
      },
    });
    expect(db.eventRegistrationAudit.create).toHaveBeenCalledWith({
      data: {
        registrationId: existingRegistration.id,
        eventId: existingRegistration.eventId,
        actorId: 'hacker-mc',
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        changeJson: {
          action: 'UPDATE_REGISTRATION_STATUS',
          publicSafeMessageChanged: true,
          internalReviewNotesChanged: true,
        },
      },
    });
  });

  it('does not write an audit record when a status update is unchanged', async () => {
    const db = createRegistrationDb();
    const existingRegistration = buildRegistration({
      id: 'registration-unchanged',
      status: 'WAITLISTED',
    });
    db.eventRegistration.findFirst.mockResolvedValue(existingRegistration);

    await expect(
      updateEventRegistrationStatus(
        {
          registrationId: existingRegistration.id,
          eventId: existingRegistration.eventId,
          actorId: 'hacker-mc',
          toStatus: 'WAITLISTED',
        },
        db
      )
    ).resolves.toBe(existingRegistration);

    expect(db.eventRegistration.update).not.toHaveBeenCalled();
    expect(db.eventRegistrationAudit.create).not.toHaveBeenCalled();
  });

  it('filters actively banned applicants from non-site-admin registration lists', async () => {
    const db = createRegistrationDb();
    const visibleRegistration = buildRegistration({
      id: 'registration-visible',
      hackerId: 'hacker-visible',
    });
    const bannedRegistration = buildRegistration({
      id: 'registration-banned',
      hackerId: 'hacker-banned',
    });
    db.eventRegistration.findMany.mockResolvedValue([
      bannedRegistration,
      visibleRegistration,
    ]);
    db.userBan.findMany.mockResolvedValue([{ hackerId: 'hacker-banned' }]);

    await expect(
      listEventRegistrations('event-boston-demo-night', false, {}, db)
    ).resolves.toEqual([visibleRegistration]);

    expect(db.eventRegistration.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-boston-demo-night' },
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

  it('keeps banned applicants visible to site admins and skips ban filtering', async () => {
    const db = createRegistrationDb();
    const registrations = [
      buildRegistration({
        id: 'registration-visible',
        hackerId: 'hacker-visible',
      }),
      buildRegistration({
        id: 'registration-banned',
        hackerId: 'hacker-banned',
      }),
    ];
    db.eventRegistration.findMany.mockResolvedValue(registrations);

    await expect(
      listEventRegistrations(
        'event-boston-demo-night',
        true,
        { includeBannedUsers: true },
        db
      )
    ).resolves.toEqual(registrations);

    expect(db.userBan.findMany).not.toHaveBeenCalled();
  });
});

describe('/api/events/[eventId]/registrations co-MC applicant decisions', () => {
  it.each(['APPROVED', 'WAITLISTED', 'DECLINED'] as const)(
    'denies co-MC status updates to %s',
    toStatus => {
      const guard = getRegistrationStatusGuard(
        { staffRole: 'CO_MC' },
        toStatus
      );

      expect(guard).toEqual({
        allowed: false,
        reason: 'CO_MC_CANNOT_DECIDE_APPLICANTS',
      });
      expect(
        canManageRegistrationStatus({ staffRole: 'CO_MC' }, toStatus)
      ).toBe(false);
    }
  );

  it('allows co-MCs to make non-decision operational status updates', () => {
    expect(
      getRegistrationStatusGuard({ staffRole: 'CO_MC' }, 'CANCELLED')
    ).toEqual({ allowed: true });
    expect(
      canManageRegistrationStatus({ staffRole: 'CO_MC' }, 'CANCELLED')
    ).toBe(true);
  });

  it('allows MCs, chapter admins, and site admins to make applicant decisions', () => {
    for (const context of [
      { staffRole: 'MC' as const },
      { isChapterAdmin: true },
      { isSiteAdmin: true },
    ]) {
      expect(getRegistrationStatusGuard(context, 'APPROVED')).toEqual({
        allowed: true,
      });
    }
  });
});
