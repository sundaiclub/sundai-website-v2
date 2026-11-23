import { render, screen } from '@testing-library/react';
import IdeasLandingPage from '@/app/ideas/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { listTodaysPublicEvents } from '@/lib/eventIdeas';

const mockProtect = jest.fn();
const mockRedirect = jest.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

jest.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: { protect: () => mockProtect() },
}));

jest.mock('@/lib/eventIdeas', () => ({
  listTodaysPublicEvents: jest.fn(),
}));

const mockListTodaysPublicEvents = listTodaysPublicEvents as jest.Mock;

describe('IdeasLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProtect.mockResolvedValue({ userId: 'user_1' });
  });

  it('sends signed-out visitors to sign in before listing events', async () => {
    mockProtect.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(IdeasLandingPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockListTodaysPublicEvents).not.toHaveBeenCalled();
  });

  const buildNight = {
    id: 'event-1',
    title: 'Boston Build Night',
    slug: 'build night',
    startTime: new Date('2026-11-10T15:00:00.000Z'),
    endTime: new Date('2026-11-11T03:00:00.000Z'),
    timezone: 'America/New_York',
    publicLocation: 'MIT',
    image: null,
    chapterName: 'Sundai Boston',
    chapterSlug: 'boston',
  };

  it('sends viewers straight to the Ideas tab when there is one event today', async () => {
    mockListTodaysPublicEvents.mockResolvedValue([buildNight]);

    await expect(IdeasLandingPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith(
      '/events/boston/build%20night?tab=ideas'
    );
  });

  it("links each of today's events to its Ideas tab", async () => {
    mockListTodaysPublicEvents.mockResolvedValue([
      buildNight,
      {
        ...buildNight,
        id: 'event-2',
        title: 'NYC Hack Day',
        slug: 'hack-day',
        publicLocation: 'Brooklyn',
        chapterName: 'Sundai NYC',
        chapterSlug: 'nyc',
      },
    ]);

    render(<ThemeProvider>{await IdeasLandingPage()}</ThemeProvider>);

    expect(
      screen.getByRole('link', { name: 'View Boston Build Night' })
    ).toHaveAttribute('href', '/events/boston/build%20night?tab=ideas');
    expect(
      screen.getByRole('link', { name: 'View NYC Hack Day' })
    ).toHaveAttribute('href', '/events/nyc/hack-day?tab=ideas');
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Sundai Boston')).toBeVisible();
    expect(
      screen.getByText(/MIT · Nov 10, 10:00\s?AM\s?–\s?10:00\s?PM EST/)
    ).toBeVisible();
  });

  it('points to upcoming events when nothing is happening today', async () => {
    mockListTodaysPublicEvents.mockResolvedValue([]);

    render(<ThemeProvider>{await IdeasLandingPage()}</ThemeProvider>);

    expect(
      screen.getByText('There are no public events happening today.')
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'See upcoming events' })
    ).toHaveAttribute('href', '/events');
  });
});
