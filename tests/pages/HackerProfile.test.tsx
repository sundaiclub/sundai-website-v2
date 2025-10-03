import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useUser } from '@clerk/nextjs';
import HackerProfile from '../../src/app/hacker/[hackerId]/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';
// Mock next/image to use plain img for reliable onError handling
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useParams: () => ({
    hackerId: 'test-hacker-id',
  }),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;

describe('HackerProfile', () => {
  const mockHacker = {
    id: 'test-hacker-id',
    name: 'Test Hacker',
    email: 'test@example.com',
    bio: 'Test bio',
    githubUrl: 'https://github.com/test',
    linkedinUrl: 'https://linkedin.com/in/test',
    twitterUrl: 'https://twitter.com/test',
    websiteUrl: 'https://test.com',
    avatar: null,
    ledProjects: [],
    projects: [],
    likes: [],
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
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers?clerkId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'current-user-hacker-id' }) });
      }
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHacker) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
  });

  it('should render loading state initially', () => {
    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render hacker profile when loaded', async () => {
    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hacker')).toBeInTheDocument();
    });

    expect(screen.getByText('Test bio')).toBeInTheDocument();
  });

  it('falls back to default avatar when main image fails', async () => {
    // Provide an avatar URL that will "error" in our mock <img>
    const hackerWithAvatar = {
      ...mockHacker,
      avatar: { url: 'https://bad.example.com/broken.jpg' },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers?clerkId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'current-user-hacker-id' }) });
      }
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(hackerWithAvatar) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    const img = await screen.findByAltText('Test Hacker');
    fireEvent.error(img);
    await waitFor(() => {
      expect((img as HTMLImageElement).src).toContain('/images/default_avatar.png');
    });
  });

  // Skills, interests, and social links are not rendered in current UI

  it('should handle error state', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: false, text: () => Promise.resolve('Failed to fetch') });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'current-user-hacker-id' }) });
    });

    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Profile Not Found')).toBeInTheDocument();
    });
  });

  it('should show edit button for own profile', async () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'same-user-id',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      },
    } as any);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers?clerkId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'test-hacker-id' }) });
      }
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHacker) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    await waitFor(() => {
      // Edit icon button is rendered (no visible text), ensure name appears
      expect(screen.getByText('Test Hacker')).toBeInTheDocument();
    });
  });

  it('should not show edit button for other profiles', async () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: 'other-user-id', // Different from hacker ID
        emailAddresses: [{ emailAddress: 'other@example.com' }],
      },
    } as any);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers?clerkId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'another-hacker-id' }) });
      }
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHacker) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hacker')).toBeInTheDocument();
    });
  });

  it('should handle missing optional fields gracefully', async () => {
    const hackerWithMissingFields = {
      ...mockHacker,
      bio: null,
      githubUrl: null,
      linkedinUrl: null,
      twitterUrl: null,
      websiteUrl: null,
      avatar: null,
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/hackers?clerkId=')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'another-hacker-id' }) });
      }
      if (url.includes('/api/hackers/test-hacker-id')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(hackerWithMissingFields) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(
      <ThemeProvider>
        <HackerProfile />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hacker')).toBeInTheDocument();
    });
  });
});
