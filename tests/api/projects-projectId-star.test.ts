import { NextRequest } from 'next/server';
import { PATCH } from '../../src/app/api/projects/[projectId]/star/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    update: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/projects/[projectId]/star', () => {
  const mockProjectId = 'test-project-id';
  const mockUserId = 'test-user-id';
  const mockHackerId = 'test-hacker-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: null });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should return 401 if user is not admin', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should successfully star project as admin', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        is_starred: true,
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { is_starred: true },
      });
    });

    it('should successfully unstar project as admin', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Test Project',
        is_starred: false,
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { is_starred: false },
      });
    });

    it('should return 500 on internal error', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
    });
  });
});
