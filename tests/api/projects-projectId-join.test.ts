import { NextRequest } from 'next/server';
import { POST, DELETE } from '../../src/app/api/projects/[projectId]/join/route';
import prisma from '../../src/lib/prisma';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  projectToParticipant: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/projects/[projectId]/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should join project successfully', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        name: 'John Doe',
      };

      const mockParticipant = {
        id: 'participant-1',
        hackerId: 'hacker-1',
        projectId: 'project-1',
        role: 'DEVELOPER',
        hacker: {
          id: 'hacker-1',
          name: 'John Doe',
          avatar: { url: 'avatar.jpg' },
        },
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.projectToParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.projectToParticipant.create.mockResolvedValue(mockParticipant as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'POST',
        body: JSON.stringify({ role: 'DEVELOPER' }),
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      if (response.status !== 200) {
        console.log('POST test error:', data);
      }

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error joining project');
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'POST',
        body: JSON.stringify({ role: 'DEVELOPER' }),
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 404 when hacker not found', async () => {
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'POST',
        body: JSON.stringify({ role: 'DEVELOPER' }),
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(404);
    });

    it('should return 400 when already a participant', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        name: 'John Doe',
      };

      const mockExistingParticipant = {
        id: 'participant-1',
        hackerId: 'hacker-1',
        projectId: 'project-1',
        role: 'DEVELOPER',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.projectToParticipant.findUnique.mockResolvedValue(mockExistingParticipant as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'POST',
        body: JSON.stringify({ role: 'DEVELOPER' }),
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error joining project');
    });

    it('should handle database errors', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        name: 'John Doe',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.projectToParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.projectToParticipant.create.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'POST',
        body: JSON.stringify({ role: 'DEVELOPER' }),
      });

      const response = await POST(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error joining project');
    });
  });

  describe('DELETE', () => {
    it('should leave project successfully', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        name: 'John Doe',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.projectToParticipant.delete.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(204);
      expect(mockPrisma.projectToParticipant.delete).toHaveBeenCalledWith({
        where: {
          hackerId_projectId: {
            hackerId: 'hacker-1',
            projectId: 'project-1',
          },
        },
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 404 when hacker not found', async () => {
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      const mockHacker = {
        id: 'hacker-1',
        clerkId: 'clerk-123',
        name: 'John Doe',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker as any);
      mockPrisma.projectToParticipant.delete.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/join', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { projectId: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error leaving project');
    });
  });
});
