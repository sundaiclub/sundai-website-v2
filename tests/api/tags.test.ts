import { GET } from '../../src/app/api/tags/[type]/route';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    techTag: {
      findMany: jest.fn(),
    },
    domainTag: {
      findMany: jest.fn(),
    },
  },
}));

describe('/api/tags/[type]', () => {
  const mockPrisma = {
    techTag: {
      findMany: jest.fn(),
    },
    domainTag: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('../../src/lib/prisma').default = mockPrisma;
  });

  describe('GET', () => {
    it('should return tech tags when type is tech', async () => {
      const mockTechTags = [
        { id: 'tag-1', name: 'React' },
        { id: 'tag-2', name: 'TypeScript' },
      ];

      mockPrisma.techTag.findMany.mockResolvedValue(mockTechTags);

      const request = new Request('http://localhost:3000/api/tags/tech');
      const response = await GET(request, { params: { type: 'tech' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockTechTags);
      expect(mockPrisma.techTag.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: {
              projects: true
            }
          }
        },
        orderBy: {
          projects: {
            _count: 'desc'
          }
        }
      });
    });

    it('should return domain tags when type is domain', async () => {
      const mockDomainTags = [
        { id: 'tag-1', name: 'Healthcare' },
        { id: 'tag-2', name: 'Education' },
      ];

      mockPrisma.domainTag.findMany.mockResolvedValue(mockDomainTags);

      const request = new Request('http://localhost:3000/api/tags/domain');
      const response = await GET(request, { params: { type: 'domain' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDomainTags);
      expect(mockPrisma.domainTag.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: {
              projects: true
            }
          }
        },
        orderBy: {
          projects: {
            _count: 'desc'
          }
        }
      });
    });

    it('should return 400 for invalid tag type', async () => {
      const request = new Request('http://localhost:3000/api/tags/invalid');
      const response = await GET(request, { params: { type: 'invalid' } });

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('{"error":"Invalid tag type"}');
    });

    it('should handle database errors for tech tags', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.techTag.findMany.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/tags/tech');
      const response = await GET(request, { params: { type: 'tech' } });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('{"error":"Failed to fetch tags"}');
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching tags:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle database errors for domain tags', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.domainTag.findMany.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/tags/domain');
      const response = await GET(request, { params: { type: 'domain' } });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('{"error":"Failed to fetch tags"}');
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching tags:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
