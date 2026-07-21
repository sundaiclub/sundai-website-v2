jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import {
  buildAddToCalendarPayload,
  GENERIC_BLOCKED_MESSAGE,
  getPublicEventBySlug,
  getViewerRegistrationState,
  listPublicEvents,
  redactPublicEventForViewer,
  type PublicEventsPrismaClient,
} from '../../src/lib/publicEvents';
import type {
  EventApplicationMode,
  JsonObject,
  RegistrationStatus,
} from '../../src/types/event-management';

type PublicEventRecord = Parameters<typeof redactPublicEventForViewer>[0];

type MockPublicEventsPrisma = PublicEventsPrismaClient & {
  event: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
  };
  applicationTemplate: {
    findFirst: jest.Mock;
  };
  eventRegistration: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  hacker: {
    findUnique: jest.Mock;
  };
  chapterMembership: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  eventStaff: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
};

function buildPublicEvent(
  overrides: Partial<PublicEventRecord> = {}
): PublicEventRecord {
  return {
    id: 'event-1',
    slug: 'demo-night',
    title: 'Demo Night',
    description: 'Public event description.',
    startTime: new Date('2026-07-10T22:00:00.000Z'),
    endTime: new Date('2026-07-11T01:00:00.000Z'),
    publicLocation: 'Sundai HQ',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    publicProgramLabel: 'Builder Demo',
    programType: 'MEETUP',
    capacity: 25,
    applicationMode: 'REQUIRES_APPROVAL' as EventApplicationMode,
    applicationsOpen: true,
    applicationsClosedAt: null,
    applicationsCloseReason: null,
    autoPromoteWaitlist: true,
    approvedDetailsJson: {
      calendarDescription: 'Check in at suite 400.',
      doorCode: '1234',
    },
    applicationQuestionsJson: [
      {
        id: 'project',
        label: 'Project',
        type: 'TEXT',
        required: true,
      },
    ],
    hideChapterDefaultQuestions: false,
    chapterId: 'chapter-1',
    chapter: {
      id: 'chapter-1',
      slug: 'nyc',
      name: 'Sundai NYC',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      accessMode: 'PUBLIC',
    },
    _count: {
      registrations: 4,
    },
    ...overrides,
  };
}

function buildPrismaMock(): MockPublicEventsPrisma {
  const siteFields = [
    {
      id: 'name',
      label: 'Name',
      type: 'TEXT',
      required: true,
      siteRequired: true,
      order: 0,
    },
    {
      id: 'email',
      label: 'Email',
      type: 'EMAIL',
      required: true,
      siteRequired: true,
      order: 1,
    },
  ];

  return {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'event-1',
        chapterId: 'chapter-1',
        applicationQuestionsJson: buildPublicEvent().applicationQuestionsJson,
        hideChapterDefaultQuestions: false,
      }),
    },
    applicationTemplate: {
      findFirst: jest.fn(({ where }) =>
        Promise.resolve(
          where.scope === 'SITE'
            ? {
                id: 'site-template-1',
                scope: 'SITE',
                chapterId: null,
                fieldsJson: siteFields,
                isActive: true,
              }
            : null
        )
      ),
    },
    eventRegistration: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    eventStaff: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as MockPublicEventsPrisma;
}

function buildRegistration(
  overrides: {
    id?: string;
    eventId?: string;
    hackerId?: string;
    status?: RegistrationStatus;
    answersJson?: JsonObject | null;
    publicSafeMessage?: string | null;
    submittedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
  } = {}
) {
  return {
    id: 'registration-1',
    eventId: 'event-1',
    hackerId: 'hacker-1',
    status: 'PENDING' as RegistrationStatus,
    answersJson: { project: 'A better demo app' },
    publicSafeMessage: null,
    submittedAt: new Date('2026-07-01T12:00:00.000Z'),
    cancelledAt: null,
    ...overrides,
  };
}

describe('public event helpers', () => {
  const now = new Date('2026-06-23T12:00:00.000Z');

  it('redacts approved-only details and approved calendar text from unapproved viewers', () => {
    const event = buildPublicEvent({
      image: {
        id: 'event-image',
        url: 'https://cdn.example.com/demo-night.webp',
        alt: 'Demo Night artwork',
      },
    });

    const publicDetail = redactPublicEventForViewer(event, {
      approvedCalendarDetails: true,
      now,
    });

    expect(publicDetail.approvedDetailsVisible).toBe(false);
    expect(publicDetail.approvedDetailsJson).toBeNull();
    expect(publicDetail.image).toEqual(event.image);
    expect(publicDetail.addToCalendar).toEqual({
      title: 'Demo Night',
      description: 'Public event description.',
      location: 'Sundai HQ',
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: 'America/New_York',
    });

    const approvedDetail = redactPublicEventForViewer(event, {
      viewerRegistration: {
        id: 'registration-approved',
        status: 'APPROVED',
        canEditAnswers: false,
        canCancel: true,
      },
      approvedCalendarDetails: true,
      now,
    });

    expect(approvedDetail.approvedDetailsVisible).toBe(true);
    expect(approvedDetail.approvedDetailsJson).toEqual({
      calendarDescription: 'Check in at suite 400.',
    });
    expect(approvedDetail.addToCalendar.description).toBe(
      'Public event description.\n\nCheck in at suite 400.'
    );
  });

  it('queries only public published upcoming events in active public chapters', async () => {
    const event = buildPublicEvent({
      id: 'event-2',
      slug: 'ai-night',
      title: 'AI Night',
    });
    const prisma = buildPrismaMock();
    prisma.event.findMany.mockResolvedValue([event]);
    prisma.eventRegistration.findMany.mockResolvedValue([
      buildRegistration({
        eventId: event.id,
        status: 'WAITLISTED',
      }),
    ]);

    const events = await listPublicEvents({
      chapterSlug: 'nyc',
      viewer: { hackerId: 'hacker-1' },
      now,
      take: 10,
      skip: 5,
      prismaClient: prisma,
    });

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        chapter: {
          status: 'ACTIVE',
          accessMode: 'PUBLIC',
          slug: 'nyc',
        },
        startTime: { gte: now },
      },
      include: {
        image: {
          select: {
            id: true,
            url: true,
            alt: true,
          },
        },
        chapter: {
          select: {
            id: true,
            slug: true,
            name: true,
            timezone: true,
            status: true,
            accessMode: true,
          },
        },
        _count: {
          select: {
            registrations: {
              where: {
                status: 'APPROVED',
                cancelledAt: null,
              },
            },
          },
        },
        pitchSessions: {
          select: { phase: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
      take: 10,
      skip: 5,
    });
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        eventId: { in: ['event-2'] },
        hackerId: 'hacker-1',
        cancelledAt: null,
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        id: 'event-2',
        slug: 'ai-night',
        chapterSlug: 'nyc',
        publicStatus: 'OPEN',
        viewerRegistrationStatus: 'WAITLISTED',
      }),
    ]);
  });

  it('skips viewer registration lookups for signed-out public event listings', async () => {
    const event = buildPublicEvent({
      id: 'event-signed-out',
      slug: 'public-showcase',
    });
    const prisma = buildPrismaMock();
    prisma.event.findMany.mockResolvedValue([event]);

    await expect(
      listPublicEvents({
        now,
        prismaClient: prisma,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'event-signed-out',
        slug: 'public-showcase',
      }),
    ]);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          chapter: {
            status: 'ACTIVE',
            accessMode: 'PUBLIC',
          },
          startTime: { gte: now },
        },
        orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
      })
    );
    expect(prisma.eventRegistration.findMany).not.toHaveBeenCalled();
  });

  it('loads public event detail by public chapter and event slug with viewer registration state', async () => {
    const event = buildPublicEvent({
      pitchSessions: [{ phase: 'VOTING' }],
    });
    const registration = buildRegistration({ status: 'APPROVED' });
    const prisma = buildPrismaMock();
    prisma.event.findFirst.mockResolvedValue(event);
    prisma.eventRegistration.findFirst.mockResolvedValue(registration);
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);

    const detail = await getPublicEventBySlug({
      chapterSlug: 'nyc',
      eventSlug: 'demo-night',
      viewer: { hackerId: 'hacker-1' },
      includeApprovedCalendarDetails: true,
      now,
      prismaClient: prisma,
    });

    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          chapter: {
            status: 'ACTIVE',
            accessMode: 'PUBLIC',
            slug: 'nyc',
          },
          slug: 'demo-night',
        },
      })
    );
    expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        hackerId: 'hacker-1',
        cancelledAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(detail).toEqual(
      expect.objectContaining({
        approvedDetailsVisible: true,
        viewerCanManageRegistrations: false,
        viewerCanEditEvent: false,
        pitchSession: { phase: 'VOTING' },
        viewerRegistration: expect.objectContaining({
          id: 'registration-1',
          status: 'APPROVED',
          canEditAnswers: false,
          canCancel: true,
        }),
      })
    );
    expect(detail?.addToCalendar.description).toBe(
      'Public event description.\n\nCheck in at suite 400.'
    );
  });

  it('uses merged site fields when an event has no custom registration questions', async () => {
    const event = buildPublicEvent({ applicationQuestionsJson: [] });
    const prisma = buildPrismaMock();
    prisma.event.findFirst.mockResolvedValue(event);
    prisma.event.findUnique.mockResolvedValue({
      id: event.id,
      chapterId: event.chapterId,
      applicationQuestionsJson: [],
      hideChapterDefaultQuestions: false,
    });

    const detail = await getPublicEventBySlug({
      chapterSlug: 'nyc',
      eventSlug: 'demo-night',
      now,
      prismaClient: prisma,
    });

    expect(
      detail?.applicationQuestionSet.composedFields.map(field => field.id)
    ).toEqual(['name', 'email']);
  });

  it('returns the latest prior answer only for questions configured for reuse', async () => {
    const event = buildPublicEvent({
      applicationQuestionsJson: [
        {
          id: 'project',
          label: 'Project',
          type: 'TEXT',
          required: true,
          reusePreviousAnswer: true,
        },
        {
          id: 'private-note',
          label: 'Private note',
          type: 'TEXT',
          required: false,
          reusePreviousAnswer: false,
        },
      ],
    });
    const prisma = buildPrismaMock();
    prisma.event.findFirst.mockResolvedValue(event);
    prisma.event.findUnique.mockResolvedValue({
      id: event.id,
      chapterId: event.chapterId,
      applicationQuestionsJson: event.applicationQuestionsJson,
      hideChapterDefaultQuestions: false,
    });
    prisma.eventRegistration.findFirst.mockResolvedValue(null);
    prisma.eventRegistration.findMany.mockResolvedValue([
      buildRegistration({
        eventId: 'event-prior-newer',
        answersJson: { project: '   ', 'private-note': 'Do not reuse this' },
      }),
      buildRegistration({
        eventId: 'event-prior-older',
        answersJson: {
          project: 'Reusable project answer',
          'private-note': 'Still do not reuse this',
        },
      }),
    ]);
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);

    const detail = await getPublicEventBySlug({
      chapterSlug: 'nyc',
      eventSlug: 'demo-night',
      viewer: { hackerId: 'hacker-1' },
      now,
      prismaClient: prisma,
    });

    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: {
        hackerId: 'hacker-1',
        eventId: { not: 'event-1' },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });
    expect(detail?.reusableAnswersJson).toEqual({
      project: 'Reusable project answer',
    });
  });

  it('marks chapter admins as able to edit public event details', async () => {
    const prisma = buildPrismaMock();
    prisma.event.findFirst.mockResolvedValue(buildPublicEvent());
    prisma.eventRegistration.findFirst.mockResolvedValue(null);
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-admin',
      role: 'HACKER',
    });
    prisma.chapterMembership.findFirst.mockResolvedValue({
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    prisma.eventStaff.findFirst.mockResolvedValue(null);

    const detail = await getPublicEventBySlug({
      chapterSlug: 'nyc',
      eventSlug: 'demo-night',
      viewer: { hackerId: 'hacker-admin' },
      now,
      prismaClient: prisma,
    });

    expect(detail).toEqual(
      expect.objectContaining({
        viewerCanEditEvent: true,
        viewerCanManageEvent: true,
        viewerCanManageRegistrations: true,
      })
    );
  });

  it.each([
    ['MC', true],
    ['CO_MC', false],
  ] as const)(
    'marks assigned %s staff attendee decision access as %s',
    async (role, expected) => {
      const prisma = buildPrismaMock();
      prisma.event.findFirst.mockResolvedValue(buildPublicEvent());
      prisma.eventRegistration.findFirst.mockResolvedValue(null);
      prisma.hacker.findUnique.mockResolvedValue({
        id: 'hacker-staff',
        role: 'HACKER',
      });
      prisma.chapterMembership.findFirst.mockResolvedValue(null);
      prisma.eventStaff.findFirst.mockResolvedValue({ role });

      const detail = await getPublicEventBySlug({
        chapterSlug: 'nyc',
        eventSlug: 'demo-night',
        viewer: { hackerId: 'hacker-staff' },
        now,
        prismaClient: prisma,
      });

      expect(detail).toEqual(
        expect.objectContaining({
          viewerCanEditEvent: false,
          viewerCanManageEvent: true,
          viewerCanManageRegistrations: expected,
        })
      );
    }
  );

  it('resolves a signed-in Clerk viewer before building application controls', async () => {
    const prisma = buildPrismaMock();
    prisma.event.findFirst.mockResolvedValue(buildPublicEvent());
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.eventRegistration.findFirst.mockResolvedValue(null);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(null);

    const detail = await getPublicEventBySlug({
      chapterSlug: 'nyc',
      eventSlug: 'demo-night',
      viewer: { clerkId: 'clerk-1' },
      now,
      prismaClient: prisma,
    });

    expect(prisma.hacker.findUnique).toHaveBeenCalledWith({
      where: { clerkId: 'clerk-1' },
      select: { id: true },
    });
    expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        hackerId: 'hacker-1',
        cancelledAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(detail?.applicationControls).toEqual(
      expect.objectContaining({
        canSubmit: true,
        signInRequired: false,
        publicMessage: null,
      })
    );
  });

  it('normalizes viewer registration state and redacts blocked messages', async () => {
    const prisma = buildPrismaMock();

    await expect(
      getViewerRegistrationState('event-1', null, prisma)
    ).resolves.toBeNull();
    expect(prisma.eventRegistration.findFirst).not.toHaveBeenCalled();

    prisma.eventRegistration.findFirst.mockResolvedValue(
      buildRegistration({
        status: 'BLOCKED',
        publicSafeMessage: 'Internal ban details should not leak.',
        answersJson: ['not', 'an', 'object'] as never,
      })
    );

    const state = await getViewerRegistrationState(
      'event-1',
      'hacker-1',
      prisma
    );

    expect(state).toEqual(
      expect.objectContaining({
        id: 'registration-1',
        status: 'BLOCKED',
        publicSafeMessage: GENERIC_BLOCKED_MESSAGE,
        canEditAnswers: false,
        canCancel: false,
        answersJson: null,
      })
    );
  });

  it('builds calendar payload fields with optional approved details text', () => {
    const event = buildPublicEvent({
      description: null,
      publicLocation: null,
      endTime: null,
      approvedDetailsJson: {
        arrivalInstructions: 'Use the rear elevator.',
      },
    });

    expect(buildAddToCalendarPayload(event)).toEqual({
      title: 'Demo Night',
      description: null,
      location: null,
      startTime: event.startTime,
      endTime: null,
      timezone: 'America/New_York',
    });

    expect(
      buildAddToCalendarPayload(event, { includeApprovedDetails: true })
    ).toEqual({
      title: 'Demo Night',
      description: 'Use the rear elevator.',
      location: null,
      startTime: event.startTime,
      endTime: null,
      timezone: 'America/New_York',
    });
  });
});
