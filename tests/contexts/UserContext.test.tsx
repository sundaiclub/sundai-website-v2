import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProvider, useUserContext } from '../../src/app/contexts/UserContext';

// Mock fetch
global.fetch = jest.fn();

// Test component that uses the user context
const TestComponent = () => {
  const { isAdmin, userInfo, loading } = useUserContext();
  
  if (loading) {
    return <div data-testid="loading">Loading...</div>;
  }
  
  return (
    <div>
      <div data-testid="is-admin">{isAdmin ? 'admin' : 'user'}</div>
      <div data-testid="user-info">{userInfo ? userInfo.name : 'no user'}</div>
    </div>
  );
};

describe('UserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should fetch and display user info when user is loaded', async () => {
    const mockHackerData = { id: 'hacker-123' };
    const mockProfileData = {
      id: 'hacker-123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'USER',
      avatar: { url: 'avatar.jpg' },
      bio: 'Test bio',
      githubUrl: 'https://github.com/john',
      phoneNumber: '123-456-7890',
      likes: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHackerData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfileData),
      });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('user');
      expect(screen.getByTestId('user-info')).toHaveTextContent('John Doe');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/hackers?clerkId=test-user-id');
    expect(global.fetch).toHaveBeenCalledWith('/api/hackers/hacker-123');
  });

  it('should set isAdmin to true when user role is ADMIN', async () => {
    const mockHackerData = { id: 'hacker-123' };
    const mockProfileData = {
      id: 'hacker-123',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'ADMIN',
      avatar: null,
      bio: null,
      githubUrl: null,
      phoneNumber: null,
      likes: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHackerData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfileData),
      });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('admin');
      expect(screen.getByTestId('user-info')).toHaveTextContent('Admin User');
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('user');
      expect(screen.getByTestId('user-info')).toHaveTextContent('no user');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching user info:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle non-ok response from hacker API', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('user');
      expect(screen.getByTestId('user-info')).toHaveTextContent('no user');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching user info:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle non-ok response from profile API', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockHackerData = { id: 'hacker-123' };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHackerData),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('user');
      expect(screen.getByTestId('user-info')).toHaveTextContent('no user');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching user info:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should set loading to false when user is not loaded', async () => {
    // Mock useUser to return no user
    const mockUseUser = jest.fn().mockReturnValue({
      user: null,
      isLoaded: true,
    });

    jest.doMock('@clerk/nextjs', () => ({
      useUser: mockUseUser,
    }));

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('user');
      expect(screen.getByTestId('user-info')).toHaveTextContent('no user');
    });
  });

  it('should return default values when useUserContext is used outside provider', () => {
    const TestComponent = () => {
      const { isAdmin, userInfo, loading } = useUserContext();
      return (
        <div>
          <div data-testid="is-admin">{isAdmin.toString()}</div>
          <div data-testid="user-info">{userInfo ? 'has-user' : 'no-user'}</div>
          <div data-testid="loading">{loading.toString()}</div>
        </div>
      );
    };

    render(<TestComponent />);
    
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('should include all user data in context', async () => {
    const mockHackerData = { id: 'hacker-123' };
    const mockProfileData = {
      id: 'hacker-123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'USER',
      avatar: { url: 'avatar.jpg' },
      bio: 'Test bio',
      githubUrl: 'https://github.com/john',
      phoneNumber: '123-456-7890',
      likes: [
        { projectId: 'project-1', createdAt: '2023-01-01T00:00:00Z' },
        { projectId: 'project-2', createdAt: '2023-01-02T00:00:00Z' },
      ],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockHackerData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfileData),
      });

    const TestComponentWithFullData = () => {
      const { userInfo } = useUserContext();
      return (
        <div>
          <div data-testid="user-name">{userInfo?.name}</div>
          <div data-testid="user-email">{userInfo?.email}</div>
          <div data-testid="user-role">{userInfo?.role}</div>
          <div data-testid="user-bio">{userInfo?.bio}</div>
          <div data-testid="user-github">{userInfo?.githubUrl}</div>
          <div data-testid="user-phone">{userInfo?.phoneNumber}</div>
          <div data-testid="user-likes-count">{userInfo?.likes?.length}</div>
        </div>
      );
    };

    render(
      <UserProvider>
        <TestComponentWithFullData />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('USER');
      expect(screen.getByTestId('user-bio')).toHaveTextContent('Test bio');
      expect(screen.getByTestId('user-github')).toHaveTextContent('https://github.com/john');
      expect(screen.getByTestId('user-phone')).toHaveTextContent('123-456-7890');
      expect(screen.getByTestId('user-likes-count')).toHaveTextContent('2');
    });
  });
});
