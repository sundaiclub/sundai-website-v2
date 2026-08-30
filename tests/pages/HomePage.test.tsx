import { render, screen, waitFor, fireEvent, act } from '../utils/test-utils';
import Home from '../../src/app/page';
import { mockProject } from '../utils/test-utils';

// Mock the hooks
jest.mock('../../src/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => {},
}));

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: {
      id: 'test-user-id',
      name: 'Test User',
    },
  }),
}));

jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
    },
    isLoaded: true,
    isSignedIn: true,
  }),
}));

const currentEvent = {
  id: 'event-current',
  slug: 'live-build',
  chapterSlug: 'boston',
  chapterName: 'Sundai Boston',
  chapter: {
    id: 'chapter-boston',
    slug: 'boston',
    name: 'Sundai Boston',
    timezone: 'America/New_York',
  },
  title: 'Live Build',
  timezone: 'America/New_York',
  publicLocation: 'Cambridge, MA',
  startTime: '2026-08-28T16:00:00.000Z',
  endTime: '2026-08-28T20:00:00.000Z',
};

describe('Home Page', () => {
  beforeEach(() => {
    const starredProject = { ...mockProject, is_starred: true };
    global.fetch = jest.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue(
            input === '/api/events/mine'
              ? [currentEvent]
              : input === '/api/events'
                ? []
                : [starredProject]
          ),
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('replaces the marketing intro with Your events', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Your events' })
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Building & Launching AI Prototypes Every Sunday.')
      ).not.toBeInTheDocument();
    });
  });

  it('renders current user events as linked rows', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'View Live Build' })
      ).toHaveAttribute('href', '/events/boston/live-build');
      expect(
        screen.getByText('Sundai Boston · Cambridge, MA')
      ).toBeInTheDocument();
      expect(screen.getByAltText('Live Build event')).toHaveAttribute(
        'src',
        '/images/logos/sundai_logo_light_horizontal.svg'
      );
    });
  });

  it('shows the Sundai intro when the user has no current events', async () => {
    const starredProject = { ...mockProject, is_starred: true };
    global.fetch = jest.fn().mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue(
            input === '/api/projects?status=APPROVED' ? [starredProject] : []
          ),
      })
    );

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Building & Launching AI Prototypes Every Sunday.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Your events' })
      ).not.toBeInTheDocument();
    });
  });

  it('renders social media links', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Github')).toBeInTheDocument();
      expect(screen.getByLabelText('Twitter')).toBeInTheDocument();
      expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    });
  });

  it('renders the foundation link', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      const foundationLink = screen.getByText('More about Sundai');
      expect(foundationLink).toBeInTheDocument();
      expect(foundationLink).toHaveAttribute(
        'href',
        'https://sundai.foundation'
      );
    });
  });

  it('renders copyright notice', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('© 2025 Sundai Club. All rights reserved.')
      ).toBeInTheDocument();
    });
  });

  it('fetches and displays projects', async () => {
    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects?status=APPROVED'
      );
      expect(global.fetch).toHaveBeenCalledWith('/api/events');
      expect(global.fetch).toHaveBeenCalledWith('/api/events/mine');
    });
  });

  it('shows loading state initially', async () => {
    // Mock fetch to resolve after a delay to ensure loading state is visible
    const starredProject = { ...mockProject, is_starred: true };
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: jest.fn().mockResolvedValue([starredProject]),
              }),
            100
          )
        )
    );

    await act(async () => {
      render(<Home />);
    });

    // Should show loading spinner immediately
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('handles like functionality', async () => {
    const mockLike = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    const starredProject = { ...mockProject, is_starred: true };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([starredProject]),
      })
      .mockImplementation(mockLike);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Test Project')[0]).toBeInTheDocument();
    });

    const likeButton = screen.getAllByRole('button', {
      name: /like project test project/i,
    })[0];

    await act(async () => {
      fireEvent.click(likeButton);
    });

    expect(mockLike).toHaveBeenCalledWith(
      '/api/projects/test-project-id/like',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Building & Launching AI Prototypes Every Sunday.')
      ).toBeInTheDocument();
    });
  });
});
