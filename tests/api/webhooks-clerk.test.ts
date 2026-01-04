import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '../../src/app/api/webhooks/clerk/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

// Mock Next.js headers function
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const { headers } = require('next/headers');

describe('/api/webhooks/clerk', () => {
  const mockWebhookSecret = 'test-webhook-secret';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, WEBHOOK_SECRET: mockWebhookSecret };
    
    // Mock headers function to return a mock Headers object
    headers.mockReturnValue({
      get: jest.fn((key: string) => {
        const mockHeaders: Record<string, string> = {
          'svix-id': 'test-id',
          'svix-timestamp': 'test-timestamp',
          'svix-signature': 'test-signature',
        };
        return mockHeaders[key] || null;
      }),
    });
  });

  // Helper function to create a mock request with json method
  const createMockRequest = (body: any) => {
    const request = new NextRequest('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': 'test-timestamp',
        'svix-signature': 'test-signature',
      },
    });
    
    // Add json method to the request
    (request as any).json = jest.fn().mockResolvedValue(body);
    
    return request;
  };

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST', () => {
    it('should return 400 if svix headers are missing', async () => {
      // Mock headers to return null for all keys
      headers.mockReturnValue({
        get: jest.fn(() => null),
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/clerk', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {},
      });

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(400);
      expect(data).toBe('Error occured -- no svix headers');
    });

    it('should return 400 if webhook verification fails', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockImplementation(() => {
          throw new Error('Verification failed');
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(400);
      expect(data).toBe('Error occured');
    });

    it('should handle user.created event successfully', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'John',
            last_name: 'Doe',
            image_url: 'https://example.com/avatar.jpg',
            username: 'johndoe',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockCreatedHacker = {
        id: 'hacker_123',
        name: 'John Doe',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'johndoe',
        role: 'HACKER',
      };

      mockPrisma.hacker.create.mockResolvedValue(mockCreatedHacker as any);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedHacker);
      expect(mockPrisma.hacker.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          clerkId: 'user_123',
          email: 'test@example.com',
          username: 'johndoe',
          role: 'HACKER',
          avatar: {
            create: {
              key: 'avatars/user_123',
              bucket: 'sundai-avatars',
              url: 'https://example.com/avatar.jpg',
              filename: 'user_123-avatar',
              mimeType: 'image/jpeg',
              size: 0,
            },
          },
        },
      });
    });

    it('should handle user.created event with only first name', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'John',
            last_name: null,
            image_url: null,
            username: null,
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockCreatedHacker = {
        id: 'hacker_123',
        name: 'John',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'test',
        role: 'HACKER',
      };

      mockPrisma.hacker.create.mockResolvedValue(mockCreatedHacker as any);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedHacker);
      expect(mockPrisma.hacker.create).toHaveBeenCalledWith({
        data: {
          name: 'John',
          clerkId: 'user_123',
          email: 'test@example.com',
          username: 'test',
          role: 'HACKER',
        },
      });
    });

    it('should handle user.created event with email username fallback', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'johndoe@example.com' }],
            first_name: null,
            last_name: null,
            image_url: null,
            username: null,
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockCreatedHacker = {
        id: 'hacker_123',
        name: 'johndoe',
        clerkId: 'user_123',
        email: 'johndoe@example.com',
        username: 'johndoe',
        role: 'HACKER',
      };

      mockPrisma.hacker.create.mockResolvedValue(mockCreatedHacker as any);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedHacker);
      expect(mockPrisma.hacker.create).toHaveBeenCalledWith({
        data: {
          name: 'johndoe',
          clerkId: 'user_123',
          email: 'johndoe@example.com',
          username: 'johndoe',
          role: 'HACKER',
        },
      });
    });

    it('should return 500 if hacker creation fails', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'John',
            last_name: 'Doe',
            image_url: null,
            username: 'johndoe',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      mockPrisma.hacker.create.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(500);
      expect(data).toBe('Error creating hacker');
    });

    it('should handle user.updated event successfully', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.updated',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'updated@example.com' }],
            first_name: 'Jane',
            last_name: 'Smith',
            image_url: 'https://example.com/new-avatar.jpg',
            username: 'janesmith',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockExistingHacker = {
        id: 'hacker_123',
        name: 'John Doe',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'johndoe',
        role: 'HACKER',
        avatar: {
          id: 'avatar_123',
          url: 'https://example.com/old-avatar.jpg',
        },
      };

      const mockUpdatedHacker = {
        id: 'hacker_123',
        name: 'Jane Smith',
        clerkId: 'user_123',
        email: 'updated@example.com',
        username: 'janesmith',
        role: 'HACKER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockExistingHacker as any);
      mockPrisma.hacker.update.mockResolvedValue(mockUpdatedHacker as any);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedHacker);
      expect(mockPrisma.hacker.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        include: { avatar: true },
      });
      expect(mockPrisma.hacker.update).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        data: {
          name: 'Jane Smith',
          email: 'updated@example.com',
          username: 'janesmith',
          avatar: {
            update: {
              url: 'https://example.com/new-avatar.jpg',
            },
          },
        },
      });
    });

    it('should handle user.updated event without existing avatar', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.updated',
          data: {
            id: 'user_456',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'Bob',
            last_name: 'Johnson',
            image_url: 'https://example.com/avatar.jpg',
            username: 'bobjohnson',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockExistingHacker = {
        id: 'hacker_456',
        name: 'Bob J',
        clerkId: 'user_456',
        email: 'test@example.com',
        username: 'bobj',
        role: 'HACKER',
        avatar: null,
      };

      const mockUpdatedHacker = {
        id: 'hacker_456',
        name: 'Bob Johnson',
        clerkId: 'user_456',
        email: 'test@example.com',
        username: 'bobjohnson',
        role: 'HACKER',
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockExistingHacker as any);
      mockPrisma.hacker.update.mockResolvedValue(mockUpdatedHacker as any);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedHacker);
      expect(mockPrisma.hacker.update).toHaveBeenCalledWith({
        where: { clerkId: 'user_456' },
        data: {
          name: 'Bob Johnson',
          email: 'test@example.com',
          username: 'bobjohnson',
          avatar: {
            create: {
              key: 'avatars/user_456',
              bucket: 'sundai-avatars',
              url: 'https://example.com/avatar.jpg',
              filename: 'user_456-avatar',
              mimeType: 'image/jpeg',
              size: 0,
            },
          },
        },
      });
    });

    it('should return 404 if hacker not found for user.updated', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.updated',
          data: {
            id: 'user_nonexistent',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'Test',
            last_name: 'User',
            image_url: null,
            username: 'testuser',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      mockPrisma.hacker.findUnique.mockResolvedValue(null);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(404);
      expect(data).toBe('Hacker not found');
    });

    it('should return 500 if hacker update fails', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.updated',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'Test',
            last_name: 'User',
            image_url: null,
            username: 'testuser',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockExistingHacker = {
        id: 'hacker_123',
        name: 'Test User',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'HACKER',
        avatar: null,
      };

      mockPrisma.hacker.findUnique.mockResolvedValue(mockExistingHacker as any);
      mockPrisma.hacker.update.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(500);
      expect(data).toBe('Error updating hacker');
    });

    it('should return 200 for other event types', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.deleted',
          data: {},
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.text();

      expect(response.status).toBe(200);
      expect(data).toBe('');
    });
  });

  describe('GET', () => {
    it('should handle GET request same as POST', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'John',
            last_name: 'Doe',
            image_url: null,
            username: 'johndoe',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockCreatedHacker = {
        id: 'hacker_123',
        name: 'John Doe',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'johndoe',
        role: 'HACKER',
      };

      mockPrisma.hacker.create.mockResolvedValue(mockCreatedHacker as any);

      const request = createMockRequest({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedHacker);
    });
  });

  describe('PUT', () => {
    it('should handle PUT request same as POST', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.created',
          data: {
            id: 'user_123',
            email_addresses: [{ email_address: 'test@example.com' }],
            first_name: 'John',
            last_name: 'Doe',
            image_url: null,
            username: 'johndoe',
          },
        }),
      };
      Webhook.mockImplementation(() => mockWebhook);

      const mockCreatedHacker = {
        id: 'hacker_123',
        name: 'John Doe',
        clerkId: 'user_123',
        email: 'test@example.com',
        username: 'johndoe',
        role: 'HACKER',
      };

      mockPrisma.hacker.create.mockResolvedValue(mockCreatedHacker as any);

      const request = createMockRequest({});

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockCreatedHacker);
    });
  });
});
