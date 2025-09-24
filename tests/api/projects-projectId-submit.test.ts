import { NextRequest } from 'next/server';
import { PATCH } from '../../src/app/api/projects/[projectId]/submit/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
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
  });

  describe('PATCH', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should return 404 if user not found', async () => {
      // Debug: Check if auth mock is working
      console.log('Auth mock before test:', mockAuth.mockReturnValue);
      console.log('Auth mock calls:', mockAuth.mock.calls);
      
      mockAuth.mockReturnValue({ userId: mockUserId });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      try {
        const response = await PATCH(request, { params: { projectId: mockProjectId } });
        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', data);

        expect(response.status).toBe(404);
        expect(data).toBe('User not found');
      } catch (error) {
        console.error('Error in test:', error);
        throw error;
      }
    });

    it('should return 404 if project not found', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        role: 'HACKER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should allow admin to submit project', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: 'other-hacker-id',
        role: 'ADMIN',
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { status: 'PENDING' },
      });
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { status: 'PENDING' },
      });
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { status: 'PENDING' },
      });
    });

    it('should return 500 on internal error', async () => {
      mockAuth.mockReturnValue({ userId: mockUserId });

      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/submit`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
    });
  });
});
