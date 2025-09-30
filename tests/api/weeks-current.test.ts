import { GET } from '../../src/app/api/weeks/current/route';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    week: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('/api/weeks/current', () => {
  const mockPrisma = {
    week: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('../../src/lib/prisma').default = mockPrisma;
  });

  describe('GET', () => {
    it('should return current week when found', async () => {
      const mockWeek = {
        id: 'week-1',
        number: 1,
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-07T00:00:00.000Z',
        theme: 'Week 1',
        description: 'Current week',
      };

      mockPrisma.week.findFirst.mockResolvedValue(mockWeek);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockWeek);
      expect(mockPrisma.week.findFirst).toHaveBeenCalledWith({
        where: {
          startDate: { lte: expect.any(Date) },
          endDate: { gte: expect.any(Date) },
        },
        include: {
          attendance: {
            include: {
              hacker: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  role: true,
                },
              },
            },
            orderBy: {
              timestamp: 'desc',
            },
          },
          projects: {
            include: {
              thumbnail: true,
              launchLead: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return 404 when no current week found', async () => {
      mockPrisma.week.findFirst.mockResolvedValue(null);
      mockPrisma.week.findFirst.mockResolvedValueOnce(null); // First call returns null
      mockPrisma.week.create.mockResolvedValue({
        id: 'week-1',
        number: 1,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        theme: 'Week 1',
        description: 'Projects for week 1',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should handle database errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.week.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await GET();
      const data = await response.text();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
      expect(consoleSpy).toHaveBeenCalledWith('[CURRENT_WEEK_GET]', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
