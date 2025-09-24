import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useUser } from '@clerk/nextjs';
import MePage from '../../src/app/me/[[...rest]]/page';

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
  SignIn: () => <div>SignIn</div>,
}));

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}));

// Mock the API call
jest.mock('../../src/lib/api', () => ({
  getHackerByClerkId: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockGetHackerByClerkId = require('../../src/lib/api').getHackerByClerkId as jest.Mock;

describe('MeRedirect', () => {
  const mockHacker = {
    id: 'test-hacker-id',
    name: 'Test Hacker',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'current-user-id',
        emailAddresses: [{ emailAddress: 'current@example.com' }],
      },
    } as any);
    
    // Mock fetch for APIs
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('should render loading state initially', () => {
    mockGetHackerByClerkId.mockResolvedValue(mockHacker);

    render(<MePage />);

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('should redirect to hacker profile when hacker is found', async () => {
    mockGetHackerByClerkId.mockResolvedValue(mockHacker);

    render(<MePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/hacker/test-hacker-id');
    });
  });

  it('should redirect to new hacker page when hacker is not found', async () => {
    mockGetHackerByClerkId.mockResolvedValue(null);

    render(<MePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/hacker/new');
    });
  });

  it('should handle error and redirect to new hacker page', async () => {
    mockGetHackerByClerkId.mockRejectedValue(new Error('API Error'));

    render(<MePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/hacker/new');
    });
  });

  it('should handle unauthenticated user', async () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    } as any);

    render(<MePage />);

    expect(screen.getByText('Please sign in to view your profile')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    mockUseUser.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      user: null,
    } as any);

    render(<MePage />);

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('should call getHackerByClerkId with correct user ID', async () => {
    mockGetHackerByClerkId.mockResolvedValue(mockHacker);

    render(<MePage />);

    await waitFor(() => {
      expect(mockGetHackerByClerkId).toHaveBeenCalledWith('current-user-id');
    });
  });
});
