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
    },
    chapterMembership: {
      findMany: jest.fn(),
    },
    eventStaff: {
      findMany: jest.fn(),
    },
    eventRegistration: {
      findMany: jest.fn(),
    },
    hackerOrganizerNote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    hackerOrganizerNoteRevision: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;

type OrganizerNoteRoute = {
  GET: (req: Request, context: { params: { hackerId: string } }) => Promise<Response>;
  PUT: (req: Request, context: { params: { hackerId: string } }) => Promise<Response>;
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
        (hacker) => where?.id === hacker.id || where?.clerkId === hacker.clerkId
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
  prisma.chapterMembership.findMany.mockImplementation(async ({ where }: any) => {
    return memberships.filter((membership) => {
      if (where?.hackerId && membership.hackerId !== where.hackerId) return false;
      if (where?.role && membership.role !== where.role) return false;
      if (typeof where?.status === 'string' && membership.status !== where.status) {
        return false;
      }
      if (where?.status?.in && !where.status.in.includes(membership.status)) {
        return false;
      }
      return true;
    });
  });
  prisma.eventStaff.findMany.mockImplementation(async ({ where }: any) =>
    assignedStaff.filter((staff) => !where?.hackerId || staff.hackerId === where.hackerId)
  );
  prisma.eventRegistration.findMany.mockImplementation(async ({ where }: any) =>
    where?.hackerId === target.id ? targetRegistrations : []
  );
};

const expectReadAndUpdateAllowed = async ({
  actor,
  target,
  memberships,
  assignedStaff,
  targetRegistrations,
}: {
  actor: HackerFixture;
  target: HackerFixture;
  memberships?: ChapterMembershipFixture[];
  assignedStaff?: Array<EventStaffFixture & { event: { chapterId: string } }>;
  targetRegistrations?: TargetRegistration[];
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
  prisma.$transaction.mockImplementation(async (operation: any) => operation(prisma));

  const getResponse = await GET(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note`, {
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
    createJsonRequest(`/api/hackers/${target.id}/organizer-note`, {
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
}: {
  actor: HackerFixture | null;
  target: HackerFixture;
  expectedStatus: 401 | 403;
  memberships?: ChapterMembershipFixture[];
  assignedStaff?: Array<EventStaffFixture & { event: { chapterId: string } }>;
  targetRegistrations?: TargetRegistration[];
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
  prisma.$transaction.mockImplementation(async (operation: any) => operation(prisma));

  const getResponse = await GET(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note`, {
      method: 'GET',
    }) as any,
    createRouteContext({ hackerId: target.id }) as any
  );
  const putResponse = await PUT(
    createJsonRequest(`/api/hackers/${target.id}/organizer-note`, {
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
  });

  it('allows a site admin to read and update a current organizer note', async () => {
    await expectReadAndUpdateAllowed({
      actor: buildSiteAdmin(),
      target: buildHacker({
        id: 'hacker-note-target',
        clerkId: 'clerk-note-target',
      }),
    });
  });

  it('allows a relevant chapter admin to read and update a current organizer note', async () => {
    const { chapter, hacker: chapterAdmin, membership: adminMembership } =
      buildChapterAdminFixture();
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
});
