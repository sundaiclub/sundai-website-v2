import { NextRequest } from 'next/server';
import { DELETE } from '../../src/app/api/projects/[projectId]/participants/[hackerId]/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  projectToParticipant: {
    delete: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/projects/[projectId]/participants/[hackerId]', () => {
  const mockProjectId = 'test-project-id';
  const mockHackerId = 'test-hacker-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE', () => {
    it('should successfully remove participant', async () => {
      mockPrisma.projectToParticipant.delete.mockResolvedValue({
        hackerId: mockHackerId,
        projectId: mockProjectId,
      } as any);

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/participants/${mockHackerId}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { 
        params: { projectId: mockProjectId, hackerId: mockHackerId } 
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'Participant removed successfully' });
      expect(mockPrisma.projectToParticipant.delete).toHaveBeenCalledWith({
        where: {
          hackerId_projectId: {
            hackerId: mockHackerId,
            projectId: mockProjectId,
          },
        },
      });
    });

    it('should return 500 on database error', async () => {
      mockPrisma.projectToParticipant.delete.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProjectId}/participants/${mockHackerId}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { 
        params: { projectId: mockProjectId, hackerId: mockHackerId } 
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Error removing participant' });
    });
  });
});
