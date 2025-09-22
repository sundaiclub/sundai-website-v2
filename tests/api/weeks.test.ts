import { GET } from '../../src/app/api/weeks/route';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    week: {
      findMany: jest.fn(),
    },
  },
}));

describe('/api/weeks', () => {
  const mockPrisma = {
    week: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('../../src/lib/prisma').default = mockPrisma;
  });

  describe('GET', () => {
    it('should return all weeks', async () => {
      const mockWeeks = [
        {
          id: 'week-1',
          number: 1,
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-01-07T00:00:00.000Z',
          theme: 'Week 1',
          description: 'First week',
        },
        {
          id: 'week-2',
          number: 2,
          startDate: '2023-01-08T00:00:00.000Z',
          endDate: '2023-01-14T00:00:00.000Z',
          theme: 'Week 2',
          description: 'Second week',
        },
      ];

      mockPrisma.week.findMany.mockResolvedValue(mockWeeks);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockWeeks);
      expect(mockPrisma.week.findMany).toHaveBeenCalledWith({
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
        orderBy: { number: 'desc' },
      });
    });

    it('should handle database errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.week.findMany.mockRejectedValue(new Error('Database error'));

      const response = await GET();
      const data = await response.text();

      expect(response.status).toBe(500);
      expect(data).toBe('Internal Error');
      expect(consoleSpy).toHaveBeenCalledWith('[WEEKS_GET]', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
