import { NextRequest } from 'next/server';
import { PATCH } from '../../src/app/api/projects/[projectId]/edit/route';
import prisma from '../../src/lib/prisma';
import { uploadToGCS } from '../../src/lib/gcp-storage';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  hacker: {
    findUnique: jest.fn(),
  },
  image: {
    create: jest.fn(),
  },
  projectToParticipant: {
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../src/lib/gcp-storage', () => ({
  uploadToGCS: jest.fn(),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockUploadToGCS = uploadToGCS as jest.MockedFunction<typeof uploadToGCS>;

describe('/api/projects/[projectId]/edit', () => {
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: new FormData(),
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should return 404 if project is not found', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: new FormData(),
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toBe('Project not found');
    });

    it('should return 401 if user is not authorized to edit project', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-user-id',
        participants: [],
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: new FormData(),
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toBe('Unauthorized');
    });

    it('should allow admin to edit project', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-user-id',
        participants: [],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        status: 'PENDING',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('status', 'PENDING');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should allow launch lead to edit project', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        status: 'PENDING',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('status', 'PENDING');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should allow team member to edit project', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-user-id',
        participants: [{ hacker: { id: mockHackerId } }],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        status: 'PENDING',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('status', 'PENDING');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should return 403 if non-admin tries to approve project', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-user-id', // Different from mockHackerId
        participants: [{ hacker: { id: mockHackerId } }], // User is a team member
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);

      const formData = new FormData();
      formData.append('status', 'APPROVED');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toBe('Only admins can approve projects');
    });

    it('should return 403 if non-admin tries to change starred status', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: 'other-user-id', // Different from mockHackerId
        participants: [{ hacker: { id: mockHackerId } }], // User is a team member
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'HACKER',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);

      const formData = new FormData();
      formData.append('is_starred', 'true');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toBe('Only admins can change starred status');
    });

    it('should handle thumbnail upload', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUploadResult = {
        filename: 'test-image.jpg',
        url: 'https://example.com/test-image.jpg',
      };

      const mockImage = {
        id: 'image-id',
        key: 'test-image.jpg',
        url: 'https://example.com/test-image.jpg',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        thumbnail: mockImage,
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockUploadToGCS.mockResolvedValue(mockUploadResult);
      mockPrisma.image.create.mockResolvedValue(mockImage as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      // Set environment variable for the test
      process.env.GOOGLE_CLOUD_BUCKET = 'test-bucket';

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('thumbnail', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUploadToGCS).toHaveBeenCalled();
      expect(mockPrisma.image.create).toHaveBeenCalled();
    });

    it('should handle thumbnail deletion', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        thumbnail: null,
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('deleteThumbnail', 'true');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedProject);
    });

    it('should handle team management for admins and launch leads', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      const mockProject = {
        id: mockProjectId,
        launchLeadId: mockHackerId,
        participants: [],
        status: 'DRAFT',
      };

      const mockUser = {
        id: mockHackerId,
        clerkId: mockUserId,
        role: 'ADMIN',
      };

      const mockUpdatedProject = {
        id: mockProjectId,
        title: 'Updated Title',
        participants: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrisma.hacker.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.projectToParticipant.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.update.mockResolvedValue(mockUpdatedProject as any);

      const formData = new FormData();
      formData.append('title', 'Updated Title');
      formData.append('participants', JSON.stringify([{ hacker: { id: 'user1' }, role: 'hacker' }]));
      formData.append('launchLead', 'new-lead-id');

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.projectToParticipant.deleteMany).toHaveBeenCalled();
    });

    it('should return 500 on internal error', async () => {
      const { auth } = require('@clerk/nextjs/server');
      auth.mockReturnValue({ userId: mockUserId });

      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/edit`, {
        method: 'PATCH',
        body: new FormData(),
      });

      const response = await PATCH(request, { params: { projectId: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
    });
  });
});
