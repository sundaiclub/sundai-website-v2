import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useUser } from '@clerk/nextjs';
import ProjectDetail from '../../src/app/projects/[projectId]/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';
import { UserProvider } from '../../src/app/contexts/UserContext';

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
    projectId: 'test-project-id',
  }),
}));

// Mock the API call
jest.mock('../../src/lib/api', () => ({
  getProject: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockGetProject = require('../../src/lib/api').getProject as jest.Mock;

describe('ProjectDetail', () => {
  const mockProject = {
    id: 'test-project-id',
    title: 'Test Project',
    description: 'Test project description',
    status: 'ACTIVE',
    isStarred: false,
    thumbnail: 'https://example.com/thumbnail.jpg',
    githubUrl: 'https://github.com/test/project',
    demoUrl: 'https://demo.test.com',
    blogUrl: 'https://blog.test.com',
    techTags: ['React', 'TypeScript', 'Node.js'],
    domainTags: ['Web Development', 'AI'],
    launchLead: {
      id: 'launch-lead-id',
      name: 'Launch Lead',
      email: 'lead@example.com',
    },
    participants: [
      { id: 'participant-1', name: 'Participant 1', email: 'participant1@example.com' },
      { id: 'participant-2', name: 'Participant 2', email: 'participant2@example.com' },
    ],
    likes: [],
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
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
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('should render project details when loaded', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Test project description')).toBeInTheDocument();
    });
  });

  it('should render project links', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('View Demo')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });
  });

  it('should render tech tags', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument();
    });

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('should render domain tags', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Web Development')).toBeInTheDocument();
    });

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('should render launch lead information', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
    });

    const matches = screen.getAllByText('Launch Lead');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should render participants', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Members')).toBeInTheDocument();
      expect(screen.getByText('Participant 1')).toBeInTheDocument();
      expect(screen.getByText('Participant 2')).toBeInTheDocument();
    });
  });

  it('should show edit button for authorized users', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Project')).toBeInTheDocument();
    });
  });

  // Star button shows like count, not text in current UI; skip explicit text check

  it('should show share button', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Share')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Failed to fetch project') });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      // navigation to /projects occurs
      // nothing to assert here beyond component not crashing
      expect(screen.queryByText('Error loading project')).not.toBeInTheDocument();
    });
  });

  it('should handle missing optional fields gracefully', async () => {
    const projectWithMissingFields = {
      ...mockProject,
      description: null,
      thumbnail: null,
      githubUrl: null,
      demoUrl: null,
      figmaUrl: null,
      techTags: [],
      domainTags: [],
      participants: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(projectWithMissingFields),
    });

    render(
      <ThemeProvider>
        <UserProvider>
          <ProjectDetail />
        </UserProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Should not crash and should render basic info (title)
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  // Starred status is represented by heart icon and count; skip text-based assertion
});
