import { NextRequest } from 'next/server';
import { PATCH } from '../../src/app/api/projects/[projectId]/submit/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  judgingSubmission: { findMany: jest.fn().mockResolvedValue([]) },
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  event: { findMany: jest.fn() },
  eventProject: { upsert: jest.fn(), deleteMany: jest.fn() },
  pitchProject: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  pitchProjectVote: { deleteMany: jest.fn() },
  $transaction: jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations)
  ),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/projects/[projectId]/submit', () => {
  const mockProjectId = 'test-project-id';
  const mockUserId = 'test-user-id';
  const mockHackerId = 'test-hacker-id';

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default auth mock
    mockAuth.mockReturnValue({ userId: mockUserId });
    (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.pitchProject.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('PATCH', () => {
    it.each([
      [null, true, 400],
      ['', true, 400],
      ['   ', true, 400],
      ['https://gitlab.com/team/project', true, 400],
      ['https://github.com', true, 200],
      ['https://github.com/team', true, 200],
      ['https://github.com/team/project/tree/main', true, 200],
      ['https://GITHUB.COM/team/project', true, 200],
      ['https://example.com/?link=github.com/team/project', true, 200],
      [null, false, 200],
    ])(
      'checks GitHub URL %s with requirement %s (status %s)',
      async (githubUrl, requireGithubUrl, expectedStatus) => {
        mockPrisma.hacker.findUnique.mockResolvedValue({
          id: mockHackerId,
          role: 'HACKER',
        } as any);
        mockPrisma.project.findUnique.mockResolvedValue({
          id: mockProjectId,
          launchLeadId: mockHackerId,
          githubUrl,
          participants: [],
        } as any);
        (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([
          { id: 'required-event', requireGithubUrl, pitchSessions: [] },
        ]);
        mockPrisma.project.update.mockResolvedValue({
          id: mockProjectId,
          status: 'APPROVED',
        } as any);

        const response = await PATCH(
          new NextRequest(
            `http://localhost/api/projects/${mockProjectId}/submit`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'APPROVED',
                eventIds: ['required-event'],
              }),
            }
          ),
          { params: { projectId: mockProjectId } }
        );

        expect(response.status).toBe(expectedStatus);
        if (expectedStatus === 400) {
          expect(await response.json()).toEqual({
            message:
              'GitHub link is required. Enter a URL that contains github.com.',
          });
          expect(mockPrisma.project.update).not.toHaveBeenCalled();
          expect(mockPrisma.eventProject.upsert).not.toHaveBeenCalled();
          expect(mockPrisma.pitchProject.create).not.toHaveBeenCalled();
        }
      }
    );

    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should return 404 if user not found', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toBe('User not found');
    });

    it('should return 404 if project not found', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        role: 'HACKER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toBe('Project not found');
    });

    it('should return 401 if user is not authorized (not admin, launch lead, or team member)', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: 'other-hacker-id',
        role: 'HACKER',
      };

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'launch-lead-id',
        participants: [{ hackerId: 'team-member-id' }],
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should allow admin to submit project', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: 'other-hacker-id',
        role: 'SITE_ADMIN',
      };

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'launch-lead-id',
        participants: [{ hackerId: 'team-member-id' }],
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        status: 'PENDING',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should allow launch lead to submit project', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        role: 'HACKER',
      };

      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        status: 'PENDING',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should allow team member to submit project', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        role: 'HACKER',
      };

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-launch-lead-id',
        participants: [{ hackerId: mockHackerId }],
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        status: 'PENDING',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('publishes into selected events and only the open source pitch queue', async () => {
      const now = new Date('2026-08-28T17:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      const mockUser = { id: mockHackerId, role: 'HACKER' };
      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
      };
      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        status: 'APPROVED',
      };
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);
      (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-source',
          startTime: new Date('2026-08-28T16:00:00.000Z'),
          endTime: new Date('2026-08-28T21:00:00.000Z'),
          pitchSessions: [
            { id: 'pitch-1', phase: 'VOTING', defaultPitchSec: 180 },
          ],
        },
        {
          id: 'event-other',
          startTime: new Date('2026-08-28T16:00:00.000Z'),
          endTime: new Date('2026-08-28T21:00:00.000Z'),
          pitchSessions: [
            { id: 'pitch-2', phase: 'VOTING', defaultPitchSec: 180 },
          ],
        },
      ]);
      (mockPrisma.pitchProject.findFirst as jest.Mock).mockResolvedValue({
        position: 2,
      });
      (mockPrisma.eventProject.upsert as jest.Mock).mockResolvedValue({});
      (mockPrisma.pitchProject.create as jest.Mock).mockResolvedValue({});

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'APPROVED',
            eventIds: ['event-source', 'event-other'],
            sourceEventId: 'event-source',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });

      expect(response.status).toBe(200);
      expect(mockPrisma.eventProject.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.pitchProject.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.pitchProject.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pitchSessionId: 'pitch-1',
          projectId: mockProjectId,
          position: 3,
        }),
      });
      jest.useRealTimers();
    });

    it('retains a published event association without joining a pitch after the event ends', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T22:00:00.000Z'));
      mockPrisma.hacker.findUnique.mockResolvedValue({
        id: mockHackerId,
        role: 'HACKER',
      } as any);
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        status: 'APPROVED',
        launchLeadId: mockHackerId,
        participants: [],
      } as any);
      mockPrisma.project.update.mockResolvedValue({
        id: mockProjectId,
        status: 'APPROVED',
      } as any);
      (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-source',
          startTime: new Date('2026-08-28T16:00:00.000Z'),
          endTime: new Date('2026-08-28T21:00:00.000Z'),
          pitchSessions: [
            { id: 'pitch-1', phase: 'VOTING', defaultPitchSec: 180 },
          ],
        },
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'APPROVED',
            eventIds: ['event-source'],
            sourceEventId: 'event-source',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(
        (await PATCH(request, { params: { projectId: mockProjectId } })).status
      ).toBe(200);
      expect(mockPrisma.eventProject.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.pitchProject.create).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('removes an approved project and its pitch data from a selected event', async () => {
      mockPrisma.hacker.findUnique.mockResolvedValue({
        id: mockHackerId,
        role: 'HACKER',
      } as any);
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
      } as any);
      mockPrisma.project.update.mockResolvedValue({
        id: mockProjectId,
        status: 'APPROVED',
      } as any);
      (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-remove',
          startTime: new Date('2026-08-28T16:00:00.000Z'),
          endTime: new Date('2026-08-28T21:00:00.000Z'),
          pitchSessions: [],
        },
      ]);
      (mockPrisma.pitchProject.findMany as jest.Mock).mockResolvedValue([
        { id: 'pitch-project-remove' },
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'APPROVED',
            eventIds: [],
            removedEventIds: ['event-remove'],
            sourceEventId: null,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });

      expect(response.status).toBe(200);
      expect(mockPrisma.pitchProjectVote.deleteMany).toHaveBeenCalledWith({
        where: { pitchProjectId: { in: ['pitch-project-remove'] } },
      });
      expect(mockPrisma.pitchProject.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['pitch-project-remove'] } },
      });
      expect(mockPrisma.eventProject.deleteMany).toHaveBeenCalledWith({
        where: {
          projectId: mockProjectId,
          eventId: { in: ['event-remove'] },
        },
      });
    });

    it.each(['DRAFT', 'APPROVED'])(
      'saves selected events for a draft with status %s without joining the pitch on save',
      async status => {
        mockPrisma.hacker.findUnique.mockResolvedValue({
          id: mockHackerId,
          role: 'HACKER',
        } as any);
        mockPrisma.project.findUnique.mockResolvedValue({
          id: mockProjectId,
          status: 'DRAFT',
          launchLeadId: mockHackerId,
          participants: [],
        } as any);
        (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([
          { id: 'event-draft', pitchSessions: [], requireGithubUrl: true },
        ]);
        mockPrisma.project.findUnique.mockResolvedValue({
          id: mockProjectId,
          status: 'DRAFT',
          githubUrl:
            status === 'APPROVED' ? 'https://github.com/team/project' : null,
          launchLeadId: mockHackerId,
          participants: [],
        } as any);
        const request = new NextRequest(
          'http://localhost/api/projects/draft/submit',
          {
            method: 'PATCH',
            body: JSON.stringify({ status, eventIds: ['event-draft'] }),
          }
        );
        expect(
          (await PATCH(request, { params: { projectId: mockProjectId } }))
            .status
        ).toBe(200);
        expect(mockPrisma.eventProject.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: {
              eventId: 'event-draft',
              projectId: mockProjectId,
              addedById: mockHackerId,
            },
          })
        );
        expect(mockPrisma.eventProject.deleteMany).toHaveBeenCalledWith({
          where: {
            projectId: mockProjectId,
            eventId: { notIn: ['event-draft'] },
          },
        });
        expect(mockPrisma.pitchProject.create).not.toHaveBeenCalled();
        const query = (mockPrisma.event.findMany as jest.Mock).mock.calls[0][0];
        expect(query.where.AND[0].OR).not.toContainEqual(
          expect.objectContaining({ projects: expect.anything() })
        );
      }
    );

    it('clears all event selections when saving a draft without events', async () => {
      mockPrisma.hacker.findUnique.mockResolvedValue({
        id: mockHackerId,
        role: 'HACKER',
      } as any);
      mockPrisma.project.findUnique.mockResolvedValue({
        status: 'DRAFT',
        launchLeadId: mockHackerId,
        participants: [],
      } as any);
      const request = new NextRequest(
        'http://localhost/api/projects/draft/submit',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'DRAFT', eventIds: [] }),
        }
      );
      expect(
        (await PATCH(request, { params: { projectId: mockProjectId } })).status
      ).toBe(200);
      expect(mockPrisma.eventProject.deleteMany).toHaveBeenCalledWith({
        where: { projectId: mockProjectId, eventId: { notIn: [] } },
      });
      expect(mockPrisma.eventProject.upsert).not.toHaveBeenCalled();
    });

    it('rejects a stale draft selection after the submission window closes', async () => {
      const now = new Date('2026-08-28T22:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      try {
        mockPrisma.hacker.findUnique.mockResolvedValue({
          id: mockHackerId,
          role: 'HACKER',
        } as any);
        mockPrisma.project.findUnique.mockResolvedValue({
          status: 'DRAFT',
          launchLeadId: mockHackerId,
          participants: [],
        } as any);
        (mockPrisma.event.findMany as jest.Mock).mockResolvedValue([]);
        const request = new NextRequest(
          'http://localhost/api/projects/draft/submit',
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'APPROVED',
              eventIds: ['closed-event'],
            }),
          }
        );
        expect(
          (await PATCH(request, { params: { projectId: mockProjectId } }))
            .status
        ).toBe(403);
        const query = (mockPrisma.event.findMany as jest.Mock).mock.calls[0][0];
        expect(query.where.AND[0].OR).toEqual([
          { id: { in: [] } },
          {
            OR: [
              {
                judgingEnabled: false,
                startTime: { lte: now },
                endTime: { gte: now },
              },
              expect.objectContaining({
                judgingEnabled: true,
                judgingAssignmentsPublishedAt: null,
                AND: [
                  {
                    OR: expect.arrayContaining([
                      { judgingSubmissionsCloseAt: { gte: now } },
                    ]),
                  },
                ],
              }),
            ],
          },
        ]);
        expect(mockPrisma.project.update).not.toHaveBeenCalled();
        expect(mockPrisma.eventProject.upsert).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return 500 on internal error', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      mockPrisma.hacker.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/projects/${mockProjectId}/submit`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PENDING' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PATCH(request, {
        params: { projectId: mockProjectId },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
    });
  });
});
