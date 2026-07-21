import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  resetClerkMocks,
} from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    eventProject: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;
const eventId = 'event-boston-build-night';
const otherEventId = 'event-cambridge-build-night';
const projectId = 'project-shared-scheduler';

const globalProject = {
  id: projectId,
  title: 'Shared Scheduler',
  preview: 'Coordinate volunteer shifts.',
  githubUrl: 'https://github.com/example/shared-scheduler',
  demoUrl: 'https://scheduler.example.com',
  blogUrl: null,
  launchLead: { id: 'hacker-lead', name: 'Ada Builder' },
  participants: [{ hacker: { id: 'hacker-team', name: 'Grace Maker' } }],
  techTags: [{ id: 'tag-typescript', name: 'TypeScript' }],
  domainTags: [{ id: 'tag-operations', name: 'Operations' }],
};

function pitchEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pitch-project-boston',
    pitchSessionId: 'pitch-session-boston',
    projectId,
    position: 3,
    status: 'QUEUED',
    cardStatus: 'NEEDS_INFO',
    approved: true,
    isTopProject: false,
    pitchPhase: 'WAITING',
    completedAt: null,
    pitchSession: {
      id: 'pitch-session-boston',
      eventId,
      phase: 'VOTING',
    },
    project: globalProject,
    pitchVotes: [{ value: 'LIKE' }, { value: 'DISLIKE' }],
    ...overrides,
  };
}

function eventParticipation(
  entry: ReturnType<typeof pitchEntry> | null = pitchEntry(),
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 'event-project-boston',
    eventId,
    projectId,
    cardStatus: 'NEEDS_INFO',
    project: {
      ...globalProject,
      pitchEntries: entry ? [entry] : [],
    },
    ...overrides,
  };
}

function loadRoute<T>(path: string): T {
  try {
    return require(path) as T;
  } catch (error) {
    throw new Error(
      `Expected event workspace project route ${path}: ${String(error)}`
    );
  }
}

function mockOrganizer(assigned = true) {
  mockAuthenticatedClerk({ userId: 'clerk-mc' });
  prisma.hacker.findUnique.mockResolvedValue({
    id: 'hacker-mc',
    clerkId: 'clerk-mc',
    role: 'HACKER',
  });
  prisma.event.findUnique.mockResolvedValue({
    id: eventId,
    chapterId: 'chapter-boston',
    staff: assigned ? [{ role: 'MC' }] : [],
  });
  prisma.eventStaff.findFirst.mockResolvedValue(
    assigned ? { eventId, hackerId: 'hacker-mc', role: 'MC' } : null
  );
  prisma.chapterMembership.findFirst.mockResolvedValue(null);
}

describe('/api/events/[eventId]/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    mockOrganizer();
  });

  it('projects global project/team/link data with event-specific card, queue, and pitch state', async () => {
    prisma.eventProject.findMany.mockResolvedValue([eventParticipation()]);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/projects/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/projects`),
      createRouteContext({ eventId })
    );
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body.items;

    expect(response.status).toBe(200);
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'event-project-boston',
        pitchProjectId: 'pitch-project-boston',
        cardStatus: 'NEEDS_INFO',
        project: expect.objectContaining({
          id: projectId,
          title: 'Shared Scheduler',
          launchLead: expect.objectContaining({ name: 'Ada Builder' }),
          participants: expect.arrayContaining([
            expect.objectContaining({ name: 'Grace Maker' }),
          ]),
          githubUrl: globalProject.githubUrl,
          demoUrl: globalProject.demoUrl,
        }),
        queue: expect.objectContaining({ status: 'QUEUED', position: 3 }),
        pitch: expect.objectContaining({
          phase: 'WAITING',
          sessionPhase: 'VOTING',
          isTopProject: false,
        }),
      }),
    ]);
  });

  it('lists an event project that has not been added to a pitch session', async () => {
    prisma.eventProject.findMany.mockResolvedValue([
      eventParticipation(null, { cardStatus: 'DRAFT' }),
    ]);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/projects/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/projects`),
      createRouteContext({ eventId })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        id: 'event-project-boston',
        pitchProjectId: null,
        queue: null,
        pitch: null,
      })
    );
  });

  it('updates only the non-blocking event card status', async () => {
    const entry = eventParticipation();
    prisma.eventProject.findFirst.mockResolvedValue(entry);
    prisma.eventProject.update.mockResolvedValue({
      ...entry,
      cardStatus: 'SUBMITTED',
    });
    const { PATCH } = loadRoute<{ PATCH: Function }>(
      '../../src/app/api/events/[eventId]/projects/[eventProjectId]/route'
    );

    const response = await PATCH(
      createJsonRequest(`/api/events/${eventId}/projects/${entry.id}`, {
        method: 'PATCH',
        body: { cardStatus: 'SUBMITTED' },
      }),
      createRouteContext({ eventId, eventProjectId: entry.id })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: entry.id },
        data: { cardStatus: 'SUBMITTED' },
      })
    );
    expect(prisma.eventProject.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: expect.anything(),
          approved: expect.anything(),
          pitchPhase: expect.anything(),
        }),
      })
    );
  });

  it('denies unrelated users without querying or exposing project data', async () => {
    mockOrganizer(false);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/projects/route'
    );

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/projects`),
      createRouteContext({ eventId })
    );

    expect([403, 404]).toContain(response.status);
    expect(prisma.eventProject.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.text())).not.toContain(
      globalProject.title
    );
  });

  it('rejects card updates for an entry belonging to another event', async () => {
    const otherEntry = pitchEntry({
      id: 'pitch-project-cambridge',
      pitchSession: {
        id: 'pitch-session-cambridge',
        eventId: otherEventId,
        phase: 'PITCHING',
      },
    });
    prisma.eventProject.findFirst.mockResolvedValue(null);
    const { PATCH } = loadRoute<{ PATCH: Function }>(
      '../../src/app/api/events/[eventId]/projects/[eventProjectId]/route'
    );

    const response = await PATCH(
      createJsonRequest(`/api/events/${eventId}/projects/${otherEntry.id}`, {
        method: 'PATCH',
        body: { cardStatus: 'APPROVED' },
      }),
      createRouteContext({ eventId, eventProjectId: otherEntry.id })
    );

    expect(response.status).toBe(404);
    expect(prisma.eventProject.update).not.toHaveBeenCalled();
  });

  it('keeps one global project identity with independent participation state in multiple events', async () => {
    const boston = eventParticipation();
    const cambridgePitch = pitchEntry({
      id: 'pitch-project-cambridge',
      pitchSessionId: 'pitch-session-cambridge',
      cardStatus: 'APPROVED',
      position: 1,
      status: 'DONE',
      pitchPhase: 'COMPLETED',
      completedAt: new Date('2026-07-03T20:00:00.000Z'),
      pitchSession: {
        id: 'pitch-session-cambridge',
        eventId: otherEventId,
        phase: 'FINISHED',
      },
    });
    const cambridge = eventParticipation(cambridgePitch, {
      id: 'event-project-cambridge',
      eventId: otherEventId,
      cardStatus: 'APPROVED',
    });
    prisma.eventProject.findMany
      .mockResolvedValueOnce([boston])
      .mockResolvedValueOnce([cambridge]);
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/projects/route'
    );

    const first = await GET(
      createJsonRequest(`/api/events/${eventId}/projects`),
      createRouteContext({ eventId })
    );
    prisma.event.findUnique.mockResolvedValue({
      id: otherEventId,
      chapterId: 'chapter-cambridge',
      staff: [{ role: 'MC' }],
    });
    const second = await GET(
      createJsonRequest(`/api/events/${otherEventId}/projects`),
      createRouteContext({ eventId: otherEventId })
    );
    const firstBody = await first.json();
    const firstRow = firstBody.items?.[0] ?? firstBody[0];
    const secondBody = await second.json();
    const secondRow = secondBody.items?.[0] ?? secondBody[0];

    expect(firstRow.project.id).toBe(projectId);
    expect(secondRow.project.id).toBe(projectId);
    expect(firstRow.id).not.toBe(secondRow.id);
    expect(firstRow.cardStatus).toBe('NEEDS_INFO');
    expect(secondRow.cardStatus).toBe('APPROVED');
    expect(firstRow.queue.status).toBe('QUEUED');
    expect(secondRow.queue.status).toBe('DONE');
  });
});
