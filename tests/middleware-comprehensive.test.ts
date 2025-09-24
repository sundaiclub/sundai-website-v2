import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  authMiddleware: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body?: any, init?: any) => ({ status: init?.status ?? 200, body })),
    redirect: jest.fn((url: string, status: number = 302) => ({ status, url })),
  },
}));

const mockAuthMiddleware = require('@clerk/nextjs/server').authMiddleware;

describe('middleware comprehensive', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    require('../src/middleware');
  });

  it('should configure authMiddleware with correct options', () => {
    const mw = require('../src/middleware');
    expect(typeof mw.afterAuthHandler).toBe('function');
  });

  it('should have correct config matcher', () => {
    const middleware = require('../src/middleware');
    
    expect(middleware.config).toEqual({
      matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
    });
  });

  describe('afterAuth function', () => {
    let afterAuthFunction: Function;
    let mockFetch: jest.Mock;

    beforeEach(() => {
      afterAuthFunction = require('../src/middleware').afterAuthHandler;
      // Mock fetch
      mockFetch = jest.fn();
      global.fetch = mockFetch as any;
    });

    it('should allow non-project requests to pass through', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { pathname: '/api/other' },
        method: 'GET'
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
    });

    it('should allow non-PATCH/DELETE requests to pass through', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { pathname: '/api/projects/123' },
        method: 'GET'
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
    });

    it('should return 401 if no userId', async () => {
      const mockAuth = { userId: null };
      const mockReq = {
        nextUrl: { pathname: '/api/projects/123', origin: 'http://localhost:3000' },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({ json: jest.fn().mockResolvedValue({}) })
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(401);
    });

    it('should skip middleware check for submit endpoint', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { pathname: '/api/projects/123/submit', origin: 'http://localhost:3000' },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({ json: jest.fn().mockResolvedValue({}) })
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
    });

    it('should allow non-admin actions to pass through', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { pathname: '/api/projects/123', origin: 'http://localhost:3000' },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ title: 'New Title' })
        })
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
    });

    it('should check admin status for starred projects', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ is_starred: true })
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'ADMIN' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/hackers?clerkId=test-user-id');
    });

    it('should check admin status for status changes to APPROVED', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ status: 'APPROVED' })
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'ADMIN' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/hackers?clerkId=test-user-id');
    });

    it('should check admin status for DELETE requests', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'DELETE',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({})
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'ADMIN' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/hackers?clerkId=test-user-id');
    });

    it('should return 401 for non-admin users trying to star projects', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ is_starred: true })
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'HACKER' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(401);
    });

    it('should return 401 for non-admin users trying to approve projects', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ status: 'APPROVED' })
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'HACKER' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(401);
    });

    it('should return 401 for non-admin users trying to delete projects', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'DELETE',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({})
        })
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ role: 'HACKER' })
      } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(401);
    });

    it('should handle fetch errors gracefully', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockResolvedValue({ is_starred: true })
        })
      };

      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(500);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockReturnValue({
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
        })
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeUndefined();
    });

    it('should handle general errors gracefully', async () => {
      const mockAuth = { userId: 'test-user-id' };
      const mockReq = {
        nextUrl: { 
          pathname: '/api/projects/123',
          origin: 'http://localhost:3000'
        },
        method: 'PATCH',
        clone: jest.fn().mockImplementation(() => {
          throw new Error('Request clone error');
        })
      };

      const result = await afterAuthFunction(mockAuth, mockReq as any);
      expect(result).toBeTruthy();
      expect(result.status).toBe(500);
    });
  });
});
