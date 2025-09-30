import { NextRequest } from 'next/server';
import { GET, DELETE } from '../../src/app/api/projects/[projectId]/route';
import prisma from '../../src/lib/prisma';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  project: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  hacker: {
    findUnique: jest.fn(),
  },
  projectLike: {
    deleteMany: jest.fn(),
  },
  projectToParticipant: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/projects/[projectId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return project data with all relations', async () => {
      const mockProject = {
        id: 'project-1',
        title: 'Test Project',
        description: 'Test description',
        status: 'PENDING',
        thumbnail: { url: 'thumb.jpg' },
        launchLead: {
          id: 'hacker-1',
          name: 'John Doe',
          avatar: { url: 'avatar.jpg' },
        },
        participants: [
          {
            hacker: {
              id: 'hacker-2',
              name: 'Jane Smith',
              avatar: { url: 'avatar2.jpg' },
            },
          },
        ],
        likes: [
          { hackerId: 'hacker-1', createdAt: new Date('2023-01-01') },
          { hackerId: 'hacker-2', createdAt: new Date('2023-01-02') },
        ],
        techTags: [{ name: 'React' }],
        domainTags: [{ name: 'Web' }],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await GET(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        ...mockProject,
        likes: [
          { hackerId: 'hacker-1', createdAt: '2023-01-01T00:00:00.000Z' },
          { hackerId: 'hacker-2', createdAt: '2023-01-02T00:00:00.000Z' },
        ],
      });
    });

    it('should return 404 when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/nonexistent');
      const response = await GET(request, { params: { projectId: 'nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await GET(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE', () => {
    it('should delete project successfully as admin', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        role: 'ADMIN',
      };

      const mockProject = {
        id: 'project-1',
        launchLeadId: 'hacker-2',
        likes: [{ id: 'like-1' }],
        participants: [{ id: 'participant-1' }],
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.$transaction.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(204);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.projectLike.deleteMany({ where: { projectId: 'project-1' } }),
        mockPrisma.projectToParticipant.deleteMany({ where: { projectId: 'project-1' } }),
        mockPrisma.project.delete({ where: { id: 'project-1' } }),
      ]);
    });

    it('should delete project successfully as launch lead', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        role: 'USER',
      };

      const mockProject = {
        id: 'project-1',
        launchLeadId: 'hacker-1',
        likes: [{ id: 'like-1' }],
        participants: [{ id: 'participant-1' }],
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.$transaction.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(204);
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 404 when hacker not found', async () => {
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(404);
    });

    it('should return 404 when project not found', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        role: 'USER',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(404);
    });

    it('should return 401 when user is not admin or launch lead', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        role: 'USER',
      };

      const mockProject = {
        id: 'project-1',
        launchLeadId: 'hacker-2', // Different hacker
        likes: [{ id: 'like-1' }],
        participants: [{ id: 'participant-1' }],
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should handle database errors', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        role: 'ADMIN',
      };

      const mockProject = {
        id: 'project-1',
        launchLeadId: 'hacker-1',
        likes: [{ id: 'like-1' }],
        participants: [{ id: 'participant-1' }],
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(500);
    });
  });
});
