import { render, screen } from '@testing-library/react';
import IdeasLandingPage from '@/app/ideas/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { listTodaysPublicEvents } from '@/lib/eventIdeas';

jest.mock('@/lib/eventIdeas', () => ({
  listTodaysPublicEvents: jest.fn(),
}));

const mockListTodaysPublicEvents = listTodaysPublicEvents as jest.Mock;

describe('IdeasLandingPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it("links each of today's events to its Ideas tab", async () => {
    mockListTodaysPublicEvents.mockResolvedValue([
      {
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
      },
    ]);

    render(<ThemeProvider>{await IdeasLandingPage()}</ThemeProvider>);

    expect(
      screen.getByRole('link', { name: 'View Boston Build Night' })
    ).toHaveAttribute('href', '/events/boston/build%20night?tab=ideas');
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
