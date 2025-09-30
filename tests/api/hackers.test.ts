import { GET } from '../../src/app/api/hackers/route';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('/api/hackers', () => {
  const mockPrisma = {
    hacker: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    require('../../src/lib/prisma').default = mockPrisma;
  });

  describe('GET', () => {
    it('should return specific hacker when clerkId is provided', async () => {
      const mockHacker = {
        id: 'hacker-123',
        name: 'John Doe',
        role: 'USER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker);

      const request = new Request('http://localhost:3000/api/hackers?clerkId=clerk-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockHacker);
      expect(mockPrisma.hacker.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'clerk-123' },
        select: {
          id: true,
          name: true,
          role: true,
        },
      });
    });

    it('should return 404 when hacker is not found', async () => {
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/hackers?clerkId=clerk-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Builder not found' });
    });

    it('should return all hackers when no clerkId is provided', async () => {
      const mockHackers = [
        {
          id: 'hacker-1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'USER',
        },
        {
          id: 'hacker-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'ADMIN',
        },
      ];

      mockPrisma.hacker.findMany.mockResolvedValue(mockHackers);

      const request = new Request('http://localhost:3000/api/hackers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockHackers);
      expect(mockPrisma.hacker.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    });

    it('should handle database errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.hacker.findMany.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/hackers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Error fetching builder' });
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching builder:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle errors when fetching specific hacker', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/hackers?clerkId=clerk-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Error fetching builder' });
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching builder:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
