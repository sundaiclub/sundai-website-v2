import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockCurrentUser,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';
import {
  buildChapterAdminFixture,
  buildChapterMembership,
  buildCoMcFixture,
  buildEventStaffFixture,
  buildHacker,
  buildOrganizerNote,
  buildOrganizerNoteRevision,
  buildSiteAdmin,
  type ChapterMembershipFixture,
  type EventStaffFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chapterMembership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    eventStaff: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    eventRegistration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    pitchProject: {
      findFirst: jest.fn(),
    },
    userBan: {
      findFirst: jest.fn(),
    },
    hackerOrganizerNote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hackerOrganizerNoteRevision: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

type OrganizerNoteRoute = {
  GET: (
    req: Request,
    context: { params: { hackerId: string } }
  ) => Promise<Response>;
  PUT: (
    req: Request,
    context: { params: { hackerId: string } }
  ) => Promise<Response>;
};

type TargetRegistration = {
  eventId: string;
  event: {
    chapterId: string;
  };
};

const loadOrganizerNoteRoute = (): OrganizerNoteRoute => {
  try {
    const route = require('../../src/app/api/hackers/[hackerId]/organizer-note/route');
    if (typeof route.GET !== 'function' || typeof route.PUT !== 'function') {
      throw new Error('route must export GET and PUT handlers');
    }
    return route;
  } catch (error) {
    throw new Error(
      `Expected GET/PUT /api/hackers/[hackerId]/organizer-note route for T076/T079. ${String(
        error
      )}`
    );
  }
};

const mockHackerLookup = (...hackers: HackerFixture[]) => {
  prisma.hacker.findUnique.mockImplementation(async ({ where }: any) => {
    return (
      hackers.find(
        hacker => where?.id === hacker.id || where?.clerkId === hacker.clerkId
      ) ?? null
    );
  });
};

const mockActor = (actor: HackerFixture, ...extraHackers: HackerFixture[]) => {
  mockAuthenticatedClerk({ userId: actor.clerkId });
  mockCurrentUser({
    id: actor.clerkId,
    primaryEmailAddress: actor.email
      ? { id: `${actor.id}-email`, emailAddress: actor.email }
      : null,
  });
  mockHackerLookup(actor, ...extraHackers);
};

const mockOrganizerNoteRelevance = ({
  actor,
  target,
  memberships = [],
  assignedStaff = [],
  targetRegistrations = [],
}: {
  actor: HackerFixture;
  target: HackerFixture;
  memberships?: ChapterMembershipFixture[];
  assignedStaff?: Array<EventStaffFixture & { event: { chapterId: string } }>;
  targetRegistrations?: TargetRegistration[];
}) => {
  mockActor(actor, target);
  prisma.chapterMembership.findMany.mockImplementation(
    async ({ where }: any) => {
      return memberships.filter(membership => {
        if (where?.hackerId && membership.hackerId !== where.hackerId)
          return false;
        if (where?.role && membership.role !== where.role) return false;
        if (
          typeof where?.status === 'string' &&
          membership.status !== where.status
        ) {
          return false;
        }
        if (where?.status?.in && !where.status.in.includes(membership.status)) {
          return false;
        }
        return true;
      });
    }
  );
  prisma.chapterMembership.findFirst.mockImplementation(
    async ({ where }: any) =>
      memberships.find(membership => {
        if (where?.chapterId && membership.chapterId !== where.chapterId)
          return false;
        if (where?.hackerId && membership.hackerId !== where.hackerId)
          return false;
        if (where?.role && membership.role !== where.role) return false;
        if (
          typeof where?.status === 'string' &&
          membership.status !== where.status
        ) {
          return false;
        }
        if (where?.status?.in && !where.status.in.includes(membership.status)) {
          return false;
        }
        return true;
      }) ?? null
  );
  prisma.eventStaff.findMany.mockImplementation(async ({ where }: any) =>
    assignedStaff.filter(
      staff => !where?.hackerId || staff.hackerId === where.hackerId
    )
  );
  prisma.eventStaff.findFirst.mockImplementation(
    async ({ where }: any) =>
      assignedStaff.find(
        staff =>
          (!where?.eventId || staff.eventId === where.eventId) &&
          (!where?.hackerId || staff.hackerId === where.hackerId)
      ) ?? null
  );
  prisma.eventRegistration.findMany.mockImplementation(
    async ({ where }: any) =>
      where?.hackerId === target.id ? targetRegistrations : []
  );
  prisma.eventRegistration.findFirst.mockImplementation(
    async ({ where }: any) =>
      targetRegistrations.find(
        registration =>
          (!where?.eventId || registration.eventId === where.eventId) &&
          (!where?.event?.chapterId ||
            registration.event.chapterId === where.event.chapterId)
      ) ?? null
  );
  prisma.event.findUnique.mockImplementation(async ({ where }: any) => {
    const scopedStaff = assignedStaff.find(staff => staff.eventId === where.id);
    const scopedRegistration = targetRegistrations.find(
      registration => registration.eventId === where.id
    );
    if (!scopedStaff && !scopedRegistration) return null;
    return {
      id: where.id,
      chapterId:
        scopedStaff?.event.chapterId ?? scopedRegistration?.event.chapterId,
    };
  });
};

const expectReadAndUpdateAllowed = async ({
  actor,
  target,
  memberships,
  assignedStaff,
  targetRegistrations,
  scope,
}: {
  actor: HackerFixture;
  target: HackerFixture;
  memberships?: ChapterMembershipFixture[];
  assignedStaff?: Array<EventStaffFixture & { event: { chapterId: string } }>;
  targetRegistrations?: TargetRegistration[];
  scope: { eventId?: string; chapterId?: string };
}) => {
  const { GET, PUT } = loadOrganizerNoteRoute();
  const currentNote = buildOrganizerNote({
    hackerId: target.id,
    updatedById: actor.id,
  });
  const updatedNote = buildOrganizerNote({
    ...currentNote,
    body: 'Updated organizer context.',
    updatedById: actor.id,
  });
  const revision = buildOrganizerNoteRevision({
    noteId: currentNote.id,
    hackerId: target.id,
    editedById: actor.id,
  });

  mockOrganizerNoteRelevance({
    actor,
    target,
    memberships,
    assignedStaff,
    targetRegistrations,
  });
  prisma.hackerOrganizerNote.findUnique.mockResolvedValue(currentNote);
  prisma.hackerOrganizerNote.update.mockResolvedValue(updatedNote);
  prisma.hackerOrganizerNoteRevision.create.mockResolvedValue(revision);
  prisma.$transaction.mockImplementation(async (operation: any) =>
    operation(prisma)
  );

  const query = new URLSearchParams(scope as Record<string, string>).toString();
  const getResponse = await GET(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note?${query}`, {
      method: 'GET',
    }) as any,
    createRouteContext({ hackerId: target.id }) as any
  );
  const getBody = await getResponse.json();

  expect(getResponse.status).toBe(200);
  expect(getBody).toMatchObject({
    note: expect.objectContaining({
      id: currentNote.id,
      hackerId: target.id,
      body: currentNote.body,
    }),
  });

  const putResponse = await PUT(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note?${query}`, {
      method: 'PUT',
      body: { body: updatedNote.body },
    }) as any,
    createRouteContext({ hackerId: target.id }) as any
  );
  const putBody = await putResponse.json();

  expect(putResponse.status).toBe(200);
  expect(putBody).toMatchObject({
    note: expect.objectContaining({
      hackerId: target.id,
      body: updatedNote.body,
      updatedById: actor.id,
    }),
  });
  expect(prisma.hackerOrganizerNote.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: currentNote.id },
      data: expect.objectContaining({
        body: updatedNote.body,
        updatedById: actor.id,
      }),
    })
  );
  expect(prisma.hackerOrganizerNoteRevision.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        noteId: currentNote.id,
        hackerId: target.id,
        editedById: actor.id,
      }),
    })
  );
};

const expectReadAndUpdateDenied = async ({
  actor,
  target,
  expectedStatus,
  memberships = [],
  assignedStaff = [],
  targetRegistrations = [],
  scope,
}: {
  actor: HackerFixture | null;
  target: HackerFixture;
  expectedStatus: 400 | 401 | 403;
  memberships?: ChapterMembershipFixture[];
  assignedStaff?: Array<EventStaffFixture & { event: { chapterId: string } }>;
  targetRegistrations?: TargetRegistration[];
  scope?: { eventId?: string; chapterId?: string };
}) => {
  const { GET, PUT } = loadOrganizerNoteRoute();
  const currentNote = buildOrganizerNote({ hackerId: target.id });

  if (actor) {
    mockOrganizerNoteRelevance({
      actor,
      target,
      memberships,
      assignedStaff,
      targetRegistrations,
    });
  } else {
    mockSignedOutClerk();
    mockHackerLookup(target);
  }
  prisma.hackerOrganizerNote.findUnique.mockResolvedValue(currentNote);
  prisma.$transaction.mockImplementation(async (operation: any) =>
    operation(prisma)
  );

  const query = scope
    ? `?${new URLSearchParams(scope as Record<string, string>).toString()}`
    : '';
  const getResponse = await GET(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note${query}`, {
      method: 'GET',
    }) as any,
    createRouteContext({ hackerId: target.id }) as any
  );
  const putResponse = await PUT(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note${query}`, {
      method: 'PUT',
      body: { body: 'Denied update.' },
    }) as any,
    createRouteContext({ hackerId: target.id }) as any
  );

  expect(getResponse.status).toBe(expectedStatus);
  expect(putResponse.status).toBe(expectedStatus);
  expect(prisma.hackerOrganizerNote.update).not.toHaveBeenCalled();
  expect(prisma.hackerOrganizerNote.create).not.toHaveBeenCalled();
  expect(prisma.hackerOrganizerNoteRevision.create).not.toHaveBeenCalled();
};

describe('/api/hackers/[hackerId]/organizer-note', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.userBan.findFirst.mockResolvedValue(null);
  });

  it('allows a site admin to read and update a current organizer note', async () => {
    const target = buildHacker({
      id: 'hacker-note-target',
      clerkId: 'clerk-note-target',
    });
    await expectReadAndUpdateAllowed({
      actor: buildSiteAdmin(),
      target,
      memberships: [
        buildChapterMembership({
          chapterId: 'chapter-boston',
          hackerId: target.id,
          status: 'ACTIVE',
        }),
      ],
      scope: { chapterId: 'chapter-boston' },
    });
  });

  it('allows a relevant chapter admin to read and update a current organizer note', async () => {
    const {
      chapter,
      hacker: chapterAdmin,
      membership: adminMembership,
    } = buildChapterAdminFixture();
    const target = buildHacker({
      id: 'hacker-note-target',
      clerkId: 'clerk-note-target',
    });
    const targetMembership = buildChapterMembership({
      id: 'membership-note-target',
      chapterId: chapter.id,
      hackerId: target.id,
      status: 'ACTIVE',
    });

    await expectReadAndUpdateAllowed({
      actor: chapterAdmin,
      target,
      memberships: [adminMembership, targetMembership],
      scope: { chapterId: chapter.id },
    });
  });

  it('allows an assigned MC to read and update notes for hackers in their event', async () => {
    const { hacker: mc, staff } = buildEventStaffFixture();
    const target = buildHacker({
      id: 'hacker-note-target',
      clerkId: 'clerk-note-target',
    });

    await expectReadAndUpdateAllowed({
      actor: mc,
      target,
      assignedStaff: [{ ...staff, event: { chapterId: 'chapter-boston' } }],
      targetRegistrations: [
        {
          eventId: staff.eventId,
          event: { chapterId: 'chapter-boston' },
        },
      ],
      scope: { eventId: staff.eventId },
    });
  });

  it('allows an assigned co-MC to read and update notes for hackers in their event', async () => {
    const { hacker: coMc, staff } = buildCoMcFixture();
    const target = buildHacker({
      id: 'hacker-note-target',
      clerkId: 'clerk-note-target',
    });

    await expectReadAndUpdateAllowed({
      actor: coMc,
      target,
      assignedStaff: [{ ...staff, event: { chapterId: 'chapter-boston' } }],
      targetRegistrations: [
        {
          eventId: staff.eventId,
          event: { chapterId: 'chapter-boston' },
        },
      ],
      scope: { eventId: staff.eventId },
    });
  });

  it('denies a regular signed-in user reading or updating organizer notes', async () => {
    await expectReadAndUpdateDenied({
      actor: buildHacker({
        id: 'hacker-regular-user',
        clerkId: 'clerk-regular-user',
        email: 'regular@example.com',
      }),
      target: buildHacker({
        id: 'hacker-note-target',
        clerkId: 'clerk-note-target',
      }),
      expectedStatus: 403,
      scope: { chapterId: 'chapter-boston' },
    });
  });

  it('denies signed-out users reading or updating organizer notes', async () => {
    await expectReadAndUpdateDenied({
      actor: null,
      target: buildHacker({
        id: 'hacker-note-target',
        clerkId: 'clerk-note-target',
      }),
      expectedStatus: 401,
    });
  });

  it('rejects authenticated organizer-note calls without an explicit scope', async () => {
    await expectReadAndUpdateDenied({
      actor: buildSiteAdmin(),
      target: buildHacker({
        id: 'hacker-note-target',
        clerkId: 'clerk-note-target',
      }),
      expectedStatus: 400,
    });
  });
});

type EventNoteCollectionRoute = {
  GET: (
    request: Request,
    context: { params: { eventId: string } }
  ) => Promise<Response>;
};

type EventNoteRoute = {
  GET: (
    request: Request,
    context: { params: { eventId: string; hackerId: string } }
  ) => Promise<Response>;
  PUT: (
    request: Request,
    context: { params: { eventId: string; hackerId: string } }
  ) => Promise<Response>;
};

function loadEventNoteCollectionRoute(): EventNoteCollectionRoute {
  try {
    return require('../../src/app/api/events/[eventId]/notes/route');
  } catch (error) {
    throw new Error(
      `Expected event-scoped organizer-note list route: ${String(error)}`
    );
  }
}

function loadEventNoteRoute(): EventNoteRoute {
  try {
    return require('../../src/app/api/events/[eventId]/notes/[hackerId]/route');
  } catch (error) {
    throw new Error(
      `Expected event-scoped organizer-note current route: ${String(error)}`
    );
  }
}

function loadEventNoteRevisionsRoute(): Pick<EventNoteRoute, 'GET'> {
  try {
    return require('../../src/app/api/events/[eventId]/notes/[hackerId]/revisions/route');
  } catch (error) {
    throw new Error(
      `Expected event-scoped organizer-note revisions route: ${String(error)}`
    );
  }
}

describe('/api/events/[eventId]/notes', () => {
  const eventId = 'event-boston-ai-build-night';
  const target = buildHacker({
    id: 'hacker-event-note-target',
    clerkId: 'clerk-event-note-target',
    name: 'Ada Builder',
  });

  function mockEventActor(
    actor: HackerFixture,
    role: 'MC' | 'CO_MC' = 'MC',
    assigned = true
  ) {
    mockActor(actor, target);
    prisma.event.findUnique.mockResolvedValue({
      id: eventId,
      chapterId: 'chapter-boston',
      staff: assigned ? [{ role }] : [],
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue(
      assigned ? { eventId, hackerId: actor.id, role } : null
    );
    prisma.eventRegistration.findFirst.mockResolvedValue({
      id: 'registration-event-note-target',
      eventId,
      hackerId: target.id,
      status: 'APPROVED',
    });
    prisma.pitchProject.findFirst.mockResolvedValue(null);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    prisma.userBan.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (operation: any) =>
      operation(prisma)
    );
  });

  it('lists and searches only hackers relevant to the active event', async () => {
    const { hacker: mc } = buildEventStaffFixture({
      staff: { eventId },
    });
    const note = buildOrganizerNote({ hackerId: target.id });
    mockEventActor(mc);
    prisma.hacker.findMany.mockResolvedValue([
      { ...target, organizerNote: note },
    ]);
    prisma.eventRegistration.findMany.mockResolvedValue([
      { eventId, hackerId: target.id, hacker: target },
    ]);

    const { GET } = loadEventNoteCollectionRoute();
    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/notes?search=Ada`, {
        method: 'GET',
      }) as any,
      createRouteContext({ eventId }) as any
    );
    const body = await response.json();
    const rows = Array.isArray(body) ? body : (body.items ?? body.rows);

    expect(response.status).toBe(200);
    expect(rows).toEqual([
      expect.objectContaining({
        hacker: expect.objectContaining({ id: target.id, name: 'Ada Builder' }),
        note: expect.objectContaining({ body: note.body }),
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('hacker-unrelated');
  });

  it('reads the current shared note only for a hacker relevant to this event', async () => {
    const { hacker: mc } = buildEventStaffFixture({ staff: { eventId } });
    const note = buildOrganizerNote({ hackerId: target.id });
    mockEventActor(mc);
    prisma.hackerOrganizerNote.findUnique.mockResolvedValue(note);

    const { GET } = loadEventNoteRoute();
    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/notes/${target.id}`, {
        method: 'GET',
      }) as any,
      createRouteContext({ eventId, hackerId: target.id }) as any
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      note: expect.objectContaining({ hackerId: target.id, body: note.body }),
    });
  });

  it('updates the shared current note and revision in one transaction', async () => {
    const { hacker: mc } = buildEventStaffFixture({ staff: { eventId } });
    const existing = buildOrganizerNote({ hackerId: target.id });
    const updated = buildOrganizerNote({
      ...existing,
      body: 'Needs a quiet demo station.',
      updatedById: mc.id,
    });
    mockEventActor(mc);
    prisma.hackerOrganizerNote.findUnique.mockResolvedValue(existing);
    prisma.hackerOrganizerNote.update.mockResolvedValue(updated);
    prisma.hackerOrganizerNoteRevision.create.mockResolvedValue(
      buildOrganizerNoteRevision({
        noteId: existing.id,
        hackerId: target.id,
        editedById: mc.id,
      })
    );

    const { PUT } = loadEventNoteRoute();
    const response = await PUT(
      createJsonRequest(`/api/events/${eventId}/notes/${target.id}`, {
        method: 'PUT',
        body: { body: updated.body },
      }) as any,
      createRouteContext({ eventId, hackerId: target.id }) as any
    );

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.hackerOrganizerNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: updated.body,
          updatedById: mc.id,
        }),
      })
    );
    expect(prisma.hackerOrganizerNoteRevision.create).toHaveBeenCalled();
  });

  it('denies revision history to an assigned co-MC', async () => {
    const { hacker: coMc } = buildCoMcFixture({ staff: { eventId } });
    mockEventActor(coMc, 'CO_MC');

    const { GET } = loadEventNoteRevisionsRoute();
    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/notes/${target.id}/revisions`, {
        method: 'GET',
      }) as any,
      createRouteContext({ eventId, hackerId: target.id }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.hackerOrganizerNoteRevision.findMany).not.toHaveBeenCalled();
  });

  it('denies the next scoped read immediately after event staff is removed', async () => {
    const { hacker: removedMc } = buildEventStaffFixture({
      staff: { eventId },
    });
    mockEventActor(removedMc, 'MC', false);

    const { GET } = loadEventNoteRoute();
    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/notes/${target.id}`, {
        method: 'GET',
      }) as any,
      createRouteContext({ eventId, hackerId: target.id }) as any
    );

    expect(response.status).toBe(403);
    expect(prisma.hackerOrganizerNote.findUnique).not.toHaveBeenCalled();
  });
});
