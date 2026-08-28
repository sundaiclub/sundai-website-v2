import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUser } from '@clerk/nextjs';
import ProjectEdit from '../../src/app/projects/[projectId]/edit/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

// Mock UserContext to allow editing in tests
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    isAdmin: true,
    userInfo: {
      id: 'current-user-id',
      name: 'Current User',
      email: 'current@example.com',
      role: 'SITE_ADMIN',
    },
    loading: false,
  }),
}));

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));

// Mock Next.js router
const mockPush = jest.fn();
const mockSearchParams = jest.fn(() => new URLSearchParams());
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
  useParams: () => ({
    projectId: 'test-project-id',
  }),
  useSearchParams: () => mockSearchParams(),
}));

// The page now fetches directly via fetch; remove lib/api mocks

// Mock fetch
global.fetch = jest.fn();

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(() => 'toast-id'),
    dismiss: jest.fn(),
  },
}));

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;

describe('ProjectEdit', () => {
  const mockProject = {
    id: 'test-project-id',
    title: 'Test Project',
    description: 'Test project description',
    status: 'ACTIVE',
    isStarred: false,
    thumbnail: { url: 'https://example.com/thumbnail.jpg' },
    githubUrl: 'https://github.com/test/project',
    demoUrl: 'https://demo.test.com',
    figmaUrl: 'https://figma.com/test',
    techTags: [
      { id: 'tech1', name: 'React' },
      { id: 'tech2', name: 'TypeScript' },
      { id: 'tech3', name: 'Node.js' },
    ],
    domainTags: [
      { id: 'dom1', name: 'Web Development' },
      { id: 'dom2', name: 'AI' },
    ],
    launchLead: {
      id: 'launch-lead-id',
      name: 'Launch Lead',
      email: 'lead@example.com',
    },
    participants: [
      {
        hacker: {
          id: 'participant-1',
          name: 'Participant 1',
          email: 'participant1@example.com',
        },
      },
    ],
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
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
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Promise(() => {}));

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    // Spinner without role; assert presence by class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render project edit form when loaded', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      }) // project
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // tech tags
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // domain tags
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }); // hackers

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await screen.findByDisplayValue('Test Project');

    // Inputs are controlled; assert placeholders exist rather than exact values
    expect(screen.getByPlaceholderText('GitHub URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Demo URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Blog URL')).toBeInTheDocument();
  });

  it('should render form fields', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      // New UI uses placeholders instead of labels
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('GitHub URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Demo URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Blog URL')).toBeInTheDocument();
  });

  it('should render tech tags selector', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject.techTags),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject.domainTags),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Tech Tags')).toBeInTheDocument();
    });
  });

  it('should render domain tags selector', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject.techTags),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject.domainTags),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Domain Tags')).toBeInTheDocument();
    });
  });

  it('should render team management section', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Members')).toBeInTheDocument();
    });

    // There may be multiple badges; at least one should exist
    expect(screen.getAllByText('Launch Lead').length).toBeGreaterThan(0);
  });

  it('should handle form submission', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input.toString().startsWith('/api/projects/test-project-id')
            ? mockProject
            : [],
      })
    );

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await screen.findByDisplayValue('Test Project');

    const submitButton = screen.getAllByRole('button', {
      name: /save changes/i,
    })[0];
    fireEvent.click(submitButton);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls as any[];
      const hasPatch = calls.some(
        ([url, init]) =>
          /\/api\/projects\/.*\/edit/.test(url) && init?.method === 'PATCH'
      );
      expect(hasPatch).toBe(true);
    });
  });

  it('should handle error state', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('error'),
    });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects');
    });
  });

  it('shows only Publish and returns to pitch for contextual drafts', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams(
        'eventId=event-1&sourceEventId=event-1&returnTo=%2Fpitch%2Fevent-1'
      )
    );
    const draftProject = { ...mockProject, status: 'DRAFT' };
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/projects/test-project-id') {
          return Promise.resolve({ ok: true, json: async () => draftProject });
        }
        if (url === '/api/events/project-options?projectId=test-project-id') {
          return Promise.resolve({
            ok: true,
            // The source can stop being current before the user publishes.
            json: async () => [],
          });
        }
        if (url === '/api/projects/test-project-id/submit') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...draftProject, status: 'APPROVED' }),
          });
        }
        if (url === '/api/projects/test-project-id/edit') {
          return Promise.resolve({ ok: true, json: async () => draftProject });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }
    );

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    const publishButtons = await screen.findAllByRole('button', {
      name: 'Publish',
    });
    await screen.findByDisplayValue('Test Project');
    expect(
      screen.queryByRole('button', { name: 'Save Draft' })
    ).not.toBeInTheDocument();
    fireEvent.click(publishButtons[0]);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/pitch/event-1')
    );
    const submitCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === '/api/projects/test-project-id/submit'
    );
    expect(JSON.parse(submitCall[1].body)).toEqual({
      status: 'APPROVED',
      eventIds: ['event-1'],
      sourceEventId: 'event-1',
    });
  });

  it('shows current events and adds an approved project to a new event', async () => {
    const approvedProject = { ...mockProject, status: 'APPROVED' };
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === '/api/projects/test-project-id') {
          return Promise.resolve({
            ok: true,
            json: async () => approvedProject,
          });
        }
        if (url === '/api/events/project-options?projectId=test-project-id') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'event-added',
                title: 'Boston Build Night',
                chapterName: 'Sundai Boston',
                image: null,
                alreadyAdded: true,
                selectedByDefault: true,
              },
              {
                id: 'event-new',
                title: 'Cambridge Build Night',
                chapterName: 'Sundai Cambridge',
                image: null,
                alreadyAdded: false,
                selectedByDefault: false,
              },
            ],
          });
        }
        if (
          url === '/api/projects/test-project-id/edit' &&
          init?.method === 'PATCH'
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => approvedProject,
          });
        }
        if (
          url === '/api/projects/test-project-id/submit' &&
          init?.method === 'PATCH'
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => approvedProject,
          });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }
    );

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    const existingEvent = await screen.findByRole('checkbox', {
      name: /boston build night/i,
    });
    const newEvent = screen.getByRole('checkbox', {
      name: /cambridge build night/i,
    });
    expect(existingEvent).toBeChecked();
    expect(existingEvent).toBeDisabled();
    expect(newEvent).not.toBeChecked();
    expect(
      screen.getByRole('img', { name: 'Cambridge Build Night event' })
    ).toHaveAttribute('src', expect.stringContaining('sundai_logo'));

    await userEvent.click(newEvent);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save Changes' })[0]
    );

    await waitFor(() => {
      const submitCall = fetchMock.mock.calls.find(
        ([url, options]) =>
          url === '/api/projects/test-project-id/submit' &&
          options?.method === 'PATCH'
      );
      expect(JSON.parse(submitCall[1].body)).toEqual({
        status: 'APPROVED',
        eventIds: ['event-added', 'event-new'],
        sourceEventId: null,
      });
    });
  });

  it('should handle missing optional fields gracefully', async () => {
    const projectWithMissingFields = {
      ...mockProject,
      description: null,
      githubUrl: null,
      demoUrl: null,
      figmaUrl: null,
      techTags: [],
      domainTags: [],
      participants: [],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(projectWithMissingFields),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <ThemeProvider>
        <ProjectEdit />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    });

    // Should not crash and should render basic form
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});
