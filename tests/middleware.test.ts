import { NextRequest, NextResponse } from 'next/server';

// Mock the authMiddleware from Clerk
jest.mock('@clerk/nextjs/server', () => ({
  authMiddleware: jest.fn(() => jest.fn()),
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => new Response(JSON.stringify(data), init)),
    next: jest.fn(() => new Response(null, { status: 200 })),
  },
}));

// Import the actual middleware module
import middleware, { config } from '../src/middleware';

// Mock fetch
global.fetch = jest.fn();

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have correct config matcher', () => {
    expect(config).toEqual({
      matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
    });
  });

  it('should be a function', () => {
    expect(typeof middleware).toBe('function');
  });
});
