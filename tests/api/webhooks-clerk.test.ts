import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '../../src/app/api/webhooks/clerk/route';
import prisma from '../../src/lib/prisma';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    create: jest.fn(),
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

    it('should return 200 for other event types', async () => {
      const { Webhook } = require('svix');
      const mockWebhook = {
        verify: jest.fn().mockReturnValue({
          type: 'user.updated',
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
