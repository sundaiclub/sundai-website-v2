import { render, screen } from '@testing-library/react';
import GuideLandingPage from '@/app/guide/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { listViewerGuideEvents } from '@/lib/eventGuide';

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

jest.mock('@/lib/eventManagementApi', () => ({
  getCurrentHacker: jest.fn(),
}));

jest.mock('@/lib/eventGuide', () => ({
  listViewerGuideEvents: jest.fn(),
}));

const mockGetCurrentHacker = getCurrentHacker as jest.Mock;
const mockListViewerGuideEvents = listViewerGuideEvents as jest.Mock;

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
const viewer = { id: 'hacker-1', role: 'HACKER', name: 'Ada' };

describe('GuideLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProtect.mockResolvedValue({ userId: 'user_1' });
    mockGetCurrentHacker.mockResolvedValue(viewer);
  });

  it('sends signed-out visitors to sign in before listing guides', async () => {
    mockProtect.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(GuideLandingPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockListViewerGuideEvents).not.toHaveBeenCalled();
  });

  it('sends viewers straight to the Guide tab when they have one guide', async () => {
    mockListViewerGuideEvents.mockResolvedValue([buildNight]);

    await expect(GuideLandingPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockListViewerGuideEvents).toHaveBeenCalledWith(viewer);
    expect(mockRedirect).toHaveBeenCalledWith(
      '/events/boston/build%20night?tab=guide'
    );
  });

  it('links each event the viewer has a guide for to its Guide tab', async () => {
    mockListViewerGuideEvents.mockResolvedValue([
      buildNight,
      {
        ...buildNight,
        id: 'event-2',
        title: 'NYC Hack Day',
        slug: 'hack-day',
        chapterSlug: 'nyc',
      },
    ]);

    render(<ThemeProvider>{await GuideLandingPage()}</ThemeProvider>);

    expect(
      screen.getByRole('link', { name: 'View Boston Build Night' })
    ).toHaveAttribute('href', '/events/boston/build%20night?tab=guide');
    expect(
      screen.getByRole('link', { name: 'View NYC Hack Day' })
    ).toHaveAttribute('href', '/events/nyc/hack-day?tab=guide');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('explains when the viewer has no guides', async () => {
    mockGetCurrentHacker.mockResolvedValue(null);

    render(<ThemeProvider>{await GuideLandingPage()}</ThemeProvider>);

    expect(mockListViewerGuideEvents).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Event guides show up here once you are approved for an event.'
      )
    ).toBeVisible();
  });
});
