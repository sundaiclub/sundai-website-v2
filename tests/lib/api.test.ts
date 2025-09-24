import { getProject, updateProject, createProject, getHacker, getHackerByClerkId } from '../../src/lib/api';
import type { Project, Hacker, CreateProjectData, UpdateProjectData } from '../../src/lib/api';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('API functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProject', () => {
    it('should fetch project data', async () => {
      const mockProject: Project = {
        id: 'project-1',
        title: 'Test Project',
        description: 'Test Description',
        status: 'DRAFT',
        isStarred: false,
        techTags: ['React', 'TypeScript'],
        domainTags: ['Web Development'],
        launchLead: {
          id: 'hacker-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
        participants: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      } as Response);

      const result = await getProject('project-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1');
      expect(result).toEqual(mockProject);
    });

    it('should return null for 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getProject('nonexistent-project');

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getProject('project-1')).rejects.toThrow('Network error');
    });
  });

  describe('updateProject', () => {
    it('should update project data', async () => {
      const updateData: UpdateProjectData = {
        title: 'Updated Project',
        description: 'Updated Description',
      };
      
      const mockUpdatedProject: Project = {
        id: 'project-1',
        title: 'Updated Project',
        description: 'Updated Description',
        status: 'DRAFT',
        isStarred: false,
        techTags: ['React', 'TypeScript'],
        domainTags: ['Web Development'],
        launchLead: {
          id: 'hacker-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
        participants: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdatedProject),
      } as Response);

      const result = await updateProject('project-1', updateData);

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      expect(result).toEqual(mockUpdatedProject);
    });

    it('should handle update errors', async () => {
      const updateData: UpdateProjectData = { title: 'Updated Project' };
      mockFetch.mockRejectedValueOnce(new Error('Update failed'));

      await expect(updateProject('project-1', updateData)).rejects.toThrow('Update failed');
    });
  });

  describe('createProject', () => {
    it('should create new project', async () => {
      const createData: CreateProjectData = {
        title: 'New Project',
        description: 'New Description',
        status: 'DRAFT',
        techTags: ['React', 'TypeScript'],
        domainTags: ['Web Development'],
        launchLeadId: 'hacker-1',
        participantIds: [],
      };
      
      const mockNewProject: Project = {
        id: 'new-project',
        title: 'New Project',
        description: 'New Description',
        status: 'DRAFT',
        isStarred: false,
        techTags: ['React', 'TypeScript'],
        domainTags: ['Web Development'],
        launchLead: {
          id: 'hacker-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
        participants: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewProject),
      } as Response);

      const result = await createProject(createData);

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createData),
      });
      expect(result).toEqual(mockNewProject);
    });

    it('should handle creation errors', async () => {
      const createData: CreateProjectData = {
        title: 'New Project',
        status: 'DRAFT',
        techTags: [],
        domainTags: [],
        launchLeadId: 'hacker-1',
        participantIds: [],
      };
      
      mockFetch.mockRejectedValueOnce(new Error('Creation failed'));

      await expect(createProject(createData)).rejects.toThrow('Creation failed');
    });
  });

  describe('getHacker', () => {
    it('should fetch hacker data', async () => {
      const mockHacker: Hacker = {
        id: 'hacker-1',
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Software Developer',
        skills: ['React', 'TypeScript'],
        interests: ['Web Development'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHacker),
      } as Response);

      const result = await getHacker('hacker-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/hackers/hacker-1');
      expect(result).toEqual(mockHacker);
    });

    it('should return null for 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getHacker('nonexistent-hacker');

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getHacker('hacker-1')).rejects.toThrow('Network error');
    });
  });

  describe('getHackerByClerkId', () => {
    it('should fetch hacker by Clerk ID', async () => {
      const mockHacker: Hacker = {
        id: 'hacker-1',
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Software Developer',
        skills: ['React', 'TypeScript'],
        interests: ['Web Development'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHacker),
      } as Response);

      const result = await getHackerByClerkId('clerk-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/hackers/by-clerk-id/clerk-123');
      expect(result).toEqual(mockHacker);
    });

    it('should return null for 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await getHackerByClerkId('nonexistent-clerk-id');

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getHackerByClerkId('clerk-123')).rejects.toThrow('Network error');
    });
  });
});
