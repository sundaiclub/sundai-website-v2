import { render, screen, fireEvent, act } from '../utils/test-utils';
import TrendingSections from '../../src/app/components/TrendingSections';
import { mockProject, mockHacker } from '../utils/test-utils';

// Mock the hooks
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
}));

describe('TrendingSections Component', () => {
  const mockHandleLike = jest.fn();
  const mockEvent = {
    id: 'event-1',
    slug: 'boston-build-night',
    chapterSlug: 'boston',
    chapterName: 'Boston',
    chapter: {
      id: 'chapter-1',
      slug: 'boston',
      name: 'Boston',
      timezone: 'America/New_York',
    },
    title: 'Boston Build Night',
    publicLocation: 'Cambridge, MA',
    startTime: '2026-04-19T17:00:00.000Z',
    endTime: '2026-04-19T20:00:00.000Z',
    applicationCount: 12,
    publicStatus: 'OPEN' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders trending sections with projects', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    expect(screen.getByText('Events This Week')).toBeInTheDocument();
    expect(screen.getByText('🔥 Hot This Week')).toBeInTheDocument();
    expect(screen.getByText('⭐ Best of All Time')).toBeInTheDocument();
    expect(
      screen.queryByText('Most votes in the last 7 days.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('📈 Recent Best')).not.toBeInTheDocument();
  });

  it('renders project cards in trending sections', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    expect(screen.getAllByText('Test Project')[0]).toBeInTheDocument();
    expect(
      screen.getAllByText('A test project description')[0]
    ).toBeInTheDocument();
  });

  it('renders this week events with links to their chapter pages', async () => {
    await act(async () => {
      render(
        <TrendingSections
          events={[mockEvent]}
          projects={[]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    expect(
      screen.getByRole('link', { name: 'View Boston Build Night' })
    ).toHaveAttribute('href', '/events/boston/boston-build-night');
    expect(
      screen.queryByText(/people applied|person applied/)
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('link', { name: 'View Boston Build Night' })
        .closest('div.scroll-item')
    ).toHaveClass('w-80');
    expect(
      screen
        .getByRole('link', { name: 'View Boston Build Night' })
        .closest('article')
    ).toHaveClass('w-full', 'min-h-[360px]');
    expect(
      screen.queryByRole('link', { name: 'Edit Boston Build Night' })
    ).not.toBeInTheDocument();
  });

  it('handles like button clicks in trending cards', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    // Like button is inside ProjectCard; ensure at least one like count is shown and clickable
    const likeButtons = screen.getAllByRole('button', {
      name: /like project test project/i,
    });
    fireEvent.click(likeButtons[0]);
    expect(mockHandleLike).toHaveBeenCalled();
  });

  it('shows correct like state for liked projects', async () => {
    const likedProject = {
      ...mockProject,
      likes: [
        { hackerId: 'test-user-id', createdAt: new Date().toISOString() },
      ],
    };

    await act(async () => {
      render(
        <TrendingSections
          projects={[likedProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    const likeButtons = screen.getAllByRole('button', {
      name: /like project test project/i,
    });
    expect(likeButtons[0]).toBeInTheDocument();
  });

  it('renders project thumbnail when available', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    const thumbnail = screen.getAllByRole('img', { name: /Test Project/i })[0];
    expect(thumbnail).toBeInTheDocument();
  });

  it('wraps trending cards with link to project page', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    const cardLink = screen.getAllByRole('link', {
      name: /view project test project/i,
    })[0];
    expect(cardLink).toHaveAttribute('href', '/projects/test-project-id');
  });

  it('normalizes trending card heights (no fixed height class)', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    // Find the scroll item container that wraps the card and check height class
    const projectTitle = screen.getAllByText('Test Project')[0];
    const scrollItem = projectTitle.closest(
      'div.scroll-item'
    ) as HTMLElement | null;
    expect(scrollItem).not.toBeNull();
    expect(scrollItem?.className).not.toContain('h-[360px]');
  });

  it('handles empty projects array gracefully', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    expect(screen.getByText('Events This Week')).toBeInTheDocument();
    expect(screen.getByText('🔥 Hot This Week')).toBeInTheDocument();
    expect(screen.getByText('⭐ Best of All Time')).toBeInTheDocument();
  });

  it('renders in dark mode correctly', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={true}
        />
      );
    });

    const projectCard = screen.getAllByText('Test Project')[0].closest('div');
    // Check if the parent container has dark mode classes
    const darkModeContainer = projectCard?.closest('div[class*="bg-gray-800"]');
    expect(darkModeContainer).toBeInTheDocument();
  });

  it('shows trending badge when specified', async () => {
    await act(async () => {
      render(
        <TrendingSections
          projects={[mockProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    // The trending badge should be present in the component
    const trendingBadge = screen.getByText('🔥 Trending');
    expect(trendingBadge).toBeInTheDocument();
  });

  it('handles projects without optional fields gracefully', async () => {
    const minimalProject = {
      ...mockProject,
      githubUrl: null,
      demoUrl: null,
      blogUrl: null,
      thumbnail: null,
      launchLead: {
        ...mockProject.launchLead,
        avatar: null,
      },
    };

    await act(async () => {
      render(
        <TrendingSections
          projects={[minimalProject]}
          userInfo={mockHacker}
          handleLike={mockHandleLike}
          isDarkMode={false}
        />
      );
    });

    expect(screen.getAllByText('Test Project')[0]).toBeInTheDocument();
    expect(
      screen.getAllByText('A test project description')[0]
    ).toBeInTheDocument();
  });

  it('surfaces older projects in Hot This Week when they receive likes in the previous 7 days', async () => {
    const olderProjectWithFreshLikes = {
      ...mockProject,
      id: 'old-project-with-fresh-likes',
      title: 'Old Project With Fresh Likes',
      startDate: new Date('2024-01-01'),
      likes: [
        { hackerId: 'fresh-1', createdAt: '2026-04-13T00:00:00.000Z' },
        { hackerId: 'fresh-2', createdAt: '2026-04-14T00:00:00.000Z' },
        { hackerId: 'stale-1', createdAt: '2026-01-01T00:00:00.000Z' },
        { hackerId: 'stale-2', createdAt: '2026-01-02T00:00:00.000Z' },
        { hackerId: 'stale-3', createdAt: '2026-01-03T00:00:00.000Z' },
      ],
    };

    const newerProjectsWithStaleLikes = Array.from(
      { length: 5 },
      (_, projectIndex) => ({
        ...mockProject,
        id: `new-project-${projectIndex}`,
        title: `New Project ${projectIndex}`,
        startDate: new Date('2026-04-14'),
        likes: Array.from({ length: 4 }, (_, likeIndex) => ({
          hackerId: `stale-${projectIndex}-${likeIndex}`,
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
      })
    );

    jest.useFakeTimers().setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    try {
      await act(async () => {
        render(
          <TrendingSections
            projects={[
              ...newerProjectsWithStaleLikes,
              olderProjectWithFreshLikes,
            ]}
            userInfo={mockHacker}
            handleLike={mockHandleLike}
            isDarkMode={false}
          />
        );
      });

      expect(
        screen.getAllByRole('link', { name: /view project/i })[0]
      ).toHaveAttribute('href', '/projects/old-project-with-fresh-likes');
      expect(screen.getAllByText('5')[0]).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
