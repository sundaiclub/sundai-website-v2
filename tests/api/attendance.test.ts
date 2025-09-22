import { GET, POST } from '../../src/app/api/attendance/route';

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    week: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    attendance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('/api/attendance', () => {
  const mockAuth = jest.fn();
  const mockPrisma = {
    hacker: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    week: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    attendance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    require('@clerk/nextjs/server').auth = mockAuth;
    require('../../src/lib/prisma').default = mockPrisma;
  });

  describe('POST', () => {
    it('should create attendance record successfully', async () => {
      const mockHacker = {
        id: 'hacker-123',
        name: 'John Doe',
      };

      const mockWeek = {
        id: 'week-123',
        number: 1,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-07'),
      };

      const mockAttendance = {
        id: 'attendance-123',
        hackerId: 'hacker-123',
        weekId: 'week-123',
        timestamp: new Date().toISOString(),
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker);
      mockPrisma.week.findFirst.mockResolvedValue(mockWeek);
      mockPrisma.attendance.findUnique.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);
      mockPrisma.hacker.update.mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAttendance);
      expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
        data: {
          hackerId: 'hacker-123',
          weekId: 'week-123',
        },
      });
      expect(mockPrisma.hacker.update).toHaveBeenCalledWith({
        where: { id: 'hacker-123' },
        data: { lastAttendance: expect.any(Date) },
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');
    });

    it('should return 404 when hacker is not found', async () => {
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Builder not found');
    });

    it('should create new week when no current week exists', async () => {
      const mockHacker = {
        id: 'hacker-123',
        name: 'John Doe',
      };

      const mockNewWeek = {
        id: 'week-123',
        number: 1,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-07'),
      };

      const mockAttendance = {
        id: 'attendance-123',
        hackerId: 'hacker-123',
        weekId: 'week-123',
        timestamp: new Date(),
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker);
      mockPrisma.week.findFirst.mockResolvedValue(null);
      mockPrisma.week.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ number: 0 });
      mockPrisma.week.create.mockResolvedValue(mockNewWeek);
      mockPrisma.attendance.findUnique.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);
      mockPrisma.hacker.update.mockResolvedValue({});

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.week.create).toHaveBeenCalledWith({
        data: {
          number: 1,
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          theme: 'Week 1',
          description: 'Projects for week 1',
        },
      });
    });

    it('should return 400 when already checked in for the week', async () => {
      const mockHacker = {
        id: 'hacker-123',
        name: 'John Doe',
      };

      const mockWeek = {
        id: 'week-123',
        number: 1,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-07'),
      };

      const mockExistingAttendance = {
        id: 'attendance-123',
        hackerId: 'hacker-123',
        weekId: 'week-123',
      };

      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker);
      mockPrisma.week.findFirst.mockResolvedValue(mockWeek);
      mockPrisma.attendance.findUnique.mockResolvedValue(mockExistingAttendance);

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Already checked in for this week');
    });

    it('should handle database errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockAuth.mockReturnValue({ userId: 'clerk-123' });
      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Error');
      expect(consoleSpy).toHaveBeenCalledWith('[ATTENDANCE_POST]', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('GET', () => {
    it('should return attendance records for a specific week', async () => {
      const mockAttendance = [
        {
          id: 'attendance-1',
          hackerId: 'hacker-123',
          weekId: 'week-123',
          timestamp: '2023-01-01T10:00:00.000Z',
          hacker: {
            id: 'hacker-123',
            name: 'John Doe',
            avatar: { url: 'avatar.jpg' },
          },
        },
        {
          id: 'attendance-2',
          hackerId: 'hacker-456',
          weekId: 'week-123',
          timestamp: '2023-01-01T11:00:00.000Z',
          hacker: {
            id: 'hacker-456',
            name: 'Jane Smith',
            avatar: null,
          },
        },
      ];

      mockPrisma.attendance.findMany.mockResolvedValue(mockAttendance);

      const request = new Request('http://localhost:3000/api/attendance?weekId=week-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAttendance);
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
        where: {
          weekId: 'week-123',
        },
        include: {
          hacker: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
    });

    it('should return 400 when weekId is not provided', async () => {
      const request = new Request('http://localhost:3000/api/attendance');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Week ID is required');
    });

    it('should handle database errors in GET', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.attendance.findMany.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/attendance?weekId=week-123');
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Error');
      expect(consoleSpy).toHaveBeenCalledWith('[ATTENDANCE_GET]', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
