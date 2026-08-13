import { NextRequest } from 'next/server';
import {
  GET as GET_EVENTS,
  POST as POST_EVENTS,
} from '../../src/app/api/events/route';
import {
  DELETE as DELETE_EVENT,
  GET as GET_EVENT,
  PATCH as PATCH_EVENT,
} from '../../src/app/api/events/[eventId]/route';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventRegistration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    eventRegistrationAudit: {
      deleteMany: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
    chapterMembership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    eventStaff: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    pitchSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    pitchProject: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pitchProjectVote: {
      deleteMany: jest.fn(),
    },
    eventProject: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const prisma = require('../../src/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

function buildPublicEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    slug: 'test',
    title: 'Test',
    description: 'Public test event',
    startTime: new Date('2026-07-01T18:00:00.000Z'),
    endTime: new Date('2026-07-01T20:00:00.000Z'),
    publicLocation: 'Boston, MA',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    publicProgramLabel: null,
    programType: 'HACK_NIGHT',
    capacity: 40,
    applicationMode: 'REQUIRES_APPROVAL',
    applicationsOpen: true,
    applicationsClosedAt: null,
    applicationsCloseReason: null,
    autoPromoteWaitlist: true,
    approvedDetailsJson: null,
    applicationQuestionsJson: null,
    hideChapterDefaultQuestions: false,
    chapterId: 'chapter-boston',
    chapter: {
      id: 'chapter-boston',
      slug: 'boston',
      name: 'Sundai Boston',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      accessMode: 'PUBLIC',
    },
    _count: {
      registrations: 0,
    },
    ...overrides,
  };
}

describe('/api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ userId: null });
    prisma.chapterMembership.findMany.mockResolvedValue([]);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.event.findFirst.mockResolvedValue(null);
    prisma.eventRegistration.findMany.mockResolvedValue([]);
    prisma.eventRegistration.findFirst.mockResolvedValue(null);
  });

  it('GET lists upcoming events', async () => {
    prisma.event.findMany.mockResolvedValue([]);
    const request = new NextRequest(
      'http://localhost:3000/api/events?upcoming=true'
    );
    const res = await GET_EVENTS(request as any);
    expect(res.status).toBe(200);
  });

  it('GET organizer listing requires sign-in', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/events?organizer=true'
    );
    const res = await GET_EVENTS(request as any);
    expect(res.status).toBe(401);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it('GET organizer listing denies signed-in users without organizer permissions', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-regular' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-regular',
      role: 'HACKER',
    });
    prisma.chapterMembership.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/events?organizer=true'
    );
    const res = await GET_EVENTS(request as any);

    expect(res.status).toBe(403);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it('GET lists public upcoming events soonest first', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/events');
    const res = await GET_EVENTS(request as any);

    expect(res.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
      })
    );
  });

  it('POST requires site admin or chapter admin', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1', role: 'HACKER' });
    const request = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
    });
    request.json = jest
      .fn()
      .mockResolvedValue({ title: 'E', startTime: new Date().toISOString() });
    const res = await POST_EVENTS(request as any);
    expect(res.status).toBe(403);
  });

  it('POST creates event with VOTING phase by default', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-admin',
      role: 'SITE_ADMIN',
    });
    const created = {
      id: 'evt-1',
      title: 'Test',
      phase: 'VOTING',
      startTime: new Date().toISOString(),
    };
    prisma.event.create.mockResolvedValue(created);
    const request = new NextRequest('http://localhost:3000/api/events', {
      method: 'POST',
    });
    request.json = jest.fn().mockResolvedValue({
      title: 'Test',
      startTime: new Date().toISOString(),
    });
    const res = await POST_EVENTS(request as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pitchSessions: {
            create: expect.objectContaining({
              chapterId: 'boston',
              title: 'Test',
              createdById: 'h-admin',
            }),
          },
        }),
      })
    );
  });
});

describe('/api/events/[eventId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ userId: null });
    prisma.chapterMembership.findMany.mockResolvedValue([]);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.event.findFirst.mockResolvedValue(null);
    prisma.eventRegistration.findMany.mockResolvedValue([]);
    prisma.eventRegistration.findFirst.mockResolvedValue(null);
  });

  it('GET returns 404 when missing', async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    const request = new NextRequest('http://localhost:3000/api/events/evt-1');
    const res = await GET_EVENT(
      request as any,
      { params: { eventId: 'evt-1' } } as any
    );
    expect(res.status).toBe(404);
  });

  it('GET single event returns public event detail', async () => {
    prisma.event.findFirst.mockResolvedValue(buildPublicEvent());
    const request = new NextRequest('http://localhost:3000/api/events/evt-1');
    const res = await GET_EVENT(
      request as any,
      { params: { eventId: 'evt-1' } } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        id: 'evt-1',
        slug: 'test',
        title: 'Test',
        description: 'Public test event',
        publicLocation: 'Boston, MA',
        approvedDetailsVisible: false,
        viewerRegistration: null,
      })
    );
    expect(body.applicationControls).toEqual(
      expect.objectContaining({
        applicationMode: 'REQUIRES_APPROVAL',
        applicationsOpen: true,
        canSubmit: false,
        signInRequired: true,
      })
    );
    expect(body).not.toHaveProperty('phase');
  });

  it('GET exposes the attached pitch event to an approved attendee', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-approved' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-approved',
      role: 'HACKER',
    });
    prisma.event.findFirst.mockResolvedValue(
      buildPublicEvent({ pitchSessions: [{ phase: 'VOTING' }] })
    );
    prisma.eventRegistration.findFirst.mockResolvedValue({
      id: 'registration-approved',
      eventId: 'evt-1',
      hackerId: 'h-approved',
      status: 'APPROVED',
      submittedAt: new Date('2026-06-01T12:00:00.000Z'),
      cancelledAt: null,
    });
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.event.findUnique.mockResolvedValue({
      meetingUrl: null,
      staff: [],
      pitchSessions: [
        {
          id: 'pitch-1',
          phase: 'VOTING',
          projects: [],
        },
      ],
    });

    const response = await GET_EVENT(
      new NextRequest('http://localhost:3000/api/events/evt-1') as any,
      { params: { eventId: 'evt-1' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pitchSession).toEqual({ phase: 'VOTING' });
    expect(body.pitchSessions).toEqual([
      expect.objectContaining({ id: 'pitch-1', phase: 'VOTING' }),
    ]);
  });

  it('GET keeps the meeting URL in pitch manager refresh responses', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-mc',
      role: 'HACKER',
    });
    prisma.event.findFirst.mockResolvedValue(
      buildPublicEvent({ pitchSessions: [{ phase: 'VOTING' }] })
    );
    prisma.eventStaff.findFirst.mockResolvedValue({ role: 'MC' });
    prisma.event.findUnique.mockResolvedValue({
      meetingUrl: 'https://zoom.us/j/1234567890',
      staff: [
        {
          id: 'staff-mc',
          role: 'MC',
          hacker: { id: 'h-mc', name: 'Event MC' },
        },
      ],
      pitchSessions: [
        {
          id: 'pitch-1',
          phase: 'VOTING',
          projects: [],
        },
      ],
    });

    const response = await GET_EVENT(
      new NextRequest('http://localhost:3000/api/events/evt-1') as any,
      { params: { eventId: 'evt-1' } } as any
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meetingUrl).toBe('https://zoom.us/j/1234567890');
  });

  it('GET management event details requires sign-in', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      title: 'Test',
      phase: 'VOTING',
      startTime: new Date().toISOString(),
      projects: [],
      staff: [],
    });

    const request = new NextRequest(
      'http://localhost:3000/api/events/evt-1?management=true'
    );
    const res = await GET_EVENT(
      request as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(res.status).toBe(401);
  });

  it('GET management event details denies users without event permissions', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-regular' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-regular',
      role: 'HACKER',
    });
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'evt-1',
        title: 'Test',
        phase: 'VOTING',
        chapterId: 'chapter-boston',
        startTime: new Date().toISOString(),
        projects: [],
        staff: [],
      })
      .mockResolvedValueOnce({
        id: 'evt-1',
        chapterId: 'chapter-boston',
      });

    const request = new NextRequest(
      'http://localhost:3000/api/events/evt-1?management=true'
    );
    const res = await GET_EVENT(
      request as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(res.status).toBe(403);
  });

  it('PATCH updates active pitching allotments when timing changes', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-admin',
      role: 'SITE_ADMIN',
    });
    prisma.eventStaff.findFirst.mockResolvedValue(null);
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: 'evt-1',
        chapterId: 'chapter-boston',
      })
      .mockResolvedValueOnce({
        chapterId: 'chapter-boston',
      })
      .mockResolvedValueOnce({
        chapterId: 'chapter-boston',
      })
      .mockResolvedValueOnce({
        id: 'evt-1',
        title: 'Updated Event',
        pitchSessions: [
          {
            id: 'pitch-1',
            phase: 'PITCHING',
            topPitchSec: 330,
            defaultPitchSec: 195,
            projects: [
              {
                id: 'ep-top',
                isTopProject: true,
                allottedSec: 330,
              },
              {
                id: 'ep-regular',
                isTopProject: false,
                allottedSec: 195,
              },
            ],
          },
        ],
        staff: [],
      });
    prisma.event.update.mockResolvedValue({ id: 'evt-1' });
    prisma.pitchSession.findFirst.mockResolvedValue({
      id: 'pitch-1',
      phase: 'PITCHING',
      topPitchSec: 300,
      defaultPitchSec: 180,
    });
    prisma.pitchSession.update.mockResolvedValue({ id: 'pitch-1' });
    prisma.pitchProject.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );

    const request = new NextRequest('http://localhost:3000/api/events/evt-1', {
      method: 'PATCH',
    });
    request.json = jest.fn().mockResolvedValue({
      title: 'Updated Event',
      topPitchSec: 330,
      defaultPitchSec: 195,
    });

    const res = await PATCH_EVENT(
      request as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.pitchProject.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        pitchSessionId: 'pitch-1',
        isTopProject: true,
        status: { in: ['CURRENT', 'APPROVED'] },
      },
      data: {
        allottedSec: 330,
      },
    });
    expect(prisma.pitchProject.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        pitchSessionId: 'pitch-1',
        isTopProject: false,
        status: { in: ['CURRENT', 'APPROVED'] },
      },
      data: {
        allottedSec: 195,
      },
    });

    const body = await res.json();
    expect(body.pitchSessions[0].projects[0].allottedSec).toBe(330);
    expect(body.pitchSessions[0].projects[1].allottedSec).toBe(195);
  });

  it.each([
    ['MC', 'hacker-event-mc'],
    ['CO_MC', 'hacker-event-co-mc'],
  ])(
    'PATCH allows an MC and denies a co-MC changing event settings: %s',
    async (staffRole, hackerId) => {
      mockAuth.mockReturnValue({ userId: `clerk-${staffRole.toLowerCase()}` });
      prisma.hacker.findUnique.mockResolvedValue({
        id: hackerId,
        role: 'HACKER',
      });
      prisma.event.findUnique.mockResolvedValue({
        id: 'evt-1',
        chapterId: 'chapter-boston',
      });
      prisma.chapterMembership.findFirst.mockResolvedValue(null);
      prisma.eventStaff.findFirst.mockResolvedValue({
        id: `staff-${staffRole.toLowerCase()}`,
        eventId: 'evt-1',
        hackerId,
        role: staffRole,
      });

      const response = await PATCH_EVENT(
        new NextRequest('http://localhost:3000/api/events/evt-1', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'Unauthorized title change' }),
          headers: { 'content-type': 'application/json' },
        }) as any,
        { params: { eventId: 'evt-1' } } as any
      );

      if (staffRole === 'MC') {
        expect(response.status).toBe(200);
        expect(prisma.event.update).toHaveBeenCalled();
      } else {
        expect(response.status).toBe(403);
        expect(prisma.event.update).not.toHaveBeenCalled();
      }
    }
  );

  it('denies an assigned MC administrative fields through the settings endpoint', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-mc' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-event-mc',
      role: 'HACKER',
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      chapterId: 'chapter-boston',
    });
    prisma.chapterMembership.findFirst.mockResolvedValue(null);
    prisma.eventStaff.findFirst.mockResolvedValue({
      id: 'staff-mc',
      eventId: 'evt-1',
      hackerId: 'hacker-event-mc',
      role: 'MC',
    });

    const response = await PATCH_EVENT(
      new NextRequest('http://localhost:3000/api/events/evt-1', {
        method: 'PATCH',
        body: JSON.stringify({ applicationsOpen: false }),
        headers: { 'content-type': 'application/json' },
      }) as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(response.status).toBe(403);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('DELETE rejects non-draft events', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-admin',
      role: 'SITE_ADMIN',
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      chapterId: 'chapter-boston',
      status: 'PUBLISHED',
    });

    const response = await DELETE_EVENT(
      new NextRequest('http://localhost:3000/api/events/evt-1', {
        method: 'DELETE',
      }) as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(response.status).toBe(409);
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });

  it('DELETE removes a draft and its event-owned records transactionally', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-admin' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'h-admin',
      role: 'SITE_ADMIN',
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'evt-1',
      chapterId: 'chapter-boston',
      status: 'DRAFT',
    });
    prisma.pitchSession.findMany.mockResolvedValue([{ id: 'pitch-1' }]);
    prisma.pitchProject.findMany.mockResolvedValue([{ id: 'queue-1' }]);
    prisma.$transaction.mockResolvedValue([]);

    const response = await DELETE_EVENT(
      new NextRequest('http://localhost:3000/api/events/evt-1', {
        method: 'DELETE',
      }) as any,
      { params: { eventId: 'evt-1' } } as any
    );

    expect(response.status).toBe(204);
    expect(prisma.pitchProjectVote.deleteMany).toHaveBeenCalledWith({
      where: { pitchProjectId: { in: ['queue-1'] } },
    });
    expect(prisma.eventRegistrationAudit.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
    expect(prisma.eventProject.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
    expect(prisma.eventStaff.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
    expect(prisma.event.delete).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
