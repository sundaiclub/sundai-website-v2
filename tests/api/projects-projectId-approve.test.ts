import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/projects/[projectId]/approve/route';
import prisma from '../../src/lib/prisma';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    update: jest.fn(),
  },
}));

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/projects/[projectId]/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should approve project successfully as admin', async () => {
      const mockUser = {
        role: 'ADMIN',
      };

      const mockProject = {
        id: 'project-1',
        title: 'Test Project',
        status: 'APPROVED',
        thumbnail: { url: 'thumb.jpg' },
        launchLead: {
          id: 'hacker-1',
          name: 'John Doe',
          avatar: { url: 'avatar.jpg' },
        },
        participants: [],
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockProject as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/approve', {
        method: 'POST',
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { status: 'APPROVED' },
        include: expect.any(Object),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/approve', {
        method: 'POST',
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not admin', async () => {
      const mockUser = {
        role: 'USER',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/approve', {
        method: 'POST',
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 401 when user not found', async () => {
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/approve', {
        method: 'POST',
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should handle database errors', async () => {
      const mockUser = {
        role: 'ADMIN',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/approve', {
        method: 'POST',
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(500);
    });
  });
});
