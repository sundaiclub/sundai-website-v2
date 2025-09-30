import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/projects/[projectId]/share/route';
import prisma from '../../src/lib/prisma';
import { generateShareContent } from '../../src/lib/shareContent';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../src/lib/shareContent', () => ({
  generateShareContent: jest.fn(),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerateShareContent = generateShareContent as jest.MockedFunction<typeof generateShareContent>;

describe('/api/projects/[projectId]/share', () => {
  const mockProjectId = 'test-project-id';
  const mockUserId = 'test-user-id';
  const mockHackerId = 'test-hacker-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: null });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'twitter' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should return 400 for invalid platform', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'invalid' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toBe('Invalid platform');
    });

    it('should return 404 if user not found', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'twitter' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toBe('User not found');
    });

    it('should return 404 if project not found', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        name: 'Test User',
        email: 'test@example.com',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'twitter' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toBe('Project not found');
    });

    it('should generate share content for team member', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: mockHackerId,
        name: 'Test User',
        email: 'test@example.com',
      };

      const mockProject = {
        id: mockProjectId,
        title: 'Test Project',
        preview: 'Test preview',
        description: 'Test description',
        githubUrl: 'https://github.com/test',
        demoUrl: 'https://demo.com',
        blogUrl: 'https://blog.com',
        launchLeadId: 'other-user-id',
        launchLead: {
          id: 'other-user-id',
          name: 'Launch Lead',
          twitterUrl: 'https://twitter.com/lead',
          linkedinUrl: 'https://linkedin.com/lead',
          avatar: { url: 'https://avatar.com/lead.jpg' },
        },
        participants: [
          {
            role: 'hacker',
            hacker: {
              id: mockHackerId,
              name: 'Test User',
              bio: 'Test bio',
              twitterUrl: 'https://twitter.com/test',
              linkedinUrl: 'https://linkedin.com/test',
              avatar: { url: 'https://avatar.com/test.jpg' },
            },
          },
        ],
        techTags: [{ id: '1', name: 'React', description: 'Frontend framework' }],
        domainTags: [{ id: '1', name: 'AI', description: 'Artificial Intelligence' }],
        thumbnail: { url: 'https://thumbnail.com/test.jpg' },
        likes: [{ hackerId: 'user1', createdAt: new Date() }],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        status: 'APPROVED',
        is_starred: false,
        is_broken: false,
      };

      const mockShareContent = {
        content: 'Check out this amazing project!',
        hashtags: ['#AI', '#React'],
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockGenerateShareContent.mockResolvedValue(mockShareContent as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'twitter' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockShareContent);
      expect(mockGenerateShareContent).toHaveBeenCalledWith({
        project: expect.objectContaining({
          id: mockProjectId,
          title: 'Test Project',
          launchLead: expect.objectContaining({
            id: 'other-user-id',
            name: 'Launch Lead',
          }),
          participants: expect.arrayContaining([
            expect.objectContaining({
              role: 'hacker',
              hacker: expect.objectContaining({
                id: mockHackerId,
                name: 'Test User',
              }),
            }),
          ]),
        }),
        userInfo: mockUser,
        platform: 'twitter',
        isTeamMember: true,
      });
    });

    it('should generate share content for non-team member', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockUser = {
        id: 'other-hacker-id',
        name: 'Other User',
        email: 'other@example.com',
      };

      const mockProject = {
        id: mockProjectId,
        title: 'Test Project',
        preview: 'Test preview',
        description: 'Test description',
        githubUrl: 'https://github.com/test',
        demoUrl: 'https://demo.com',
        blogUrl: 'https://blog.com',
        launchLeadId: 'launch-lead-id',
        launchLead: {
          id: 'launch-lead-id',
          name: 'Launch Lead',
          twitterUrl: 'https://twitter.com/lead',
          linkedinUrl: 'https://linkedin.com/lead',
          avatar: { url: 'https://avatar.com/lead.jpg' },
        },
        participants: [
          {
            role: 'hacker',
            hacker: {
              id: 'team-member-id',
              name: 'Team Member',
              bio: 'Team bio',
              twitterUrl: 'https://twitter.com/team',
              linkedinUrl: 'https://linkedin.com/team',
              avatar: { url: 'https://avatar.com/team.jpg' },
            },
          },
        ],
        techTags: [{ id: '1', name: 'React', description: 'Frontend framework' }],
        domainTags: [{ id: '1', name: 'AI', description: 'Artificial Intelligence' }],
        thumbnail: { url: 'https://thumbnail.com/test.jpg' },
        likes: [{ hackerId: 'user1', createdAt: new Date() }],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        status: 'APPROVED',
        is_starred: false,
        is_broken: false,
      };

      const mockShareContent = {
        content: 'Check out this amazing project!',
        hashtags: ['#AI', '#React'],
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockGenerateShareContent.mockResolvedValue(mockShareContent as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'linkedin' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockShareContent);
      expect(mockGenerateShareContent).toHaveBeenCalledWith({
        project: expect.objectContaining({
          id: mockProjectId,
          title: 'Test Project',
        }),
        userInfo: mockUser,
        platform: 'linkedin',
        isTeamMember: false,
      });
    });

    it('should return 500 on internal error', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ platform: 'twitter' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
    });
  });
});
