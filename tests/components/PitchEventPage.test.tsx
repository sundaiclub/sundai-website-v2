import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PitchEventPage from '@/app/components/PitchEventPage';

const mockUseTheme = jest.fn();
const mockUseUser = jest.fn();
const mockUseUserContext = jest.fn();

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

describe('PitchEventPage viewer states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      userInfo: { id: 'h-viewer', name: 'Viewer' },
    });
  });

  it('only asks signed-out viewers to log in', async () => {
    mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'evt-1',
        title: 'Demo Night',
        canViewPitch: false,
        pitchPhase: 'VOTING',
      }),
    });

    render(<PitchEventPage eventId="evt-1" />);

    expect(
      await screen.findByText('You need to log in to view the pitch.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Demo Night')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /join meeting/i })
    ).not.toBeInTheDocument();
  });

  it('shows the voting-in-progress message to signed-in non-attendees', async () => {
    mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'evt-1',
        title: 'Demo Night',
        canViewPitch: false,
        pitchPhase: 'VOTING',
      }),
    });

    render(<PitchEventPage eventId="evt-1" />);

    expect(
      await screen.findByText('Voting is currently happening.')
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Demo Night')).not.toBeInTheDocument();
    });
  });

  it('uses prominent header actions without a voting-open badge', async () => {
    mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'evt-1',
        slug: 'demo-night',
        title: 'Demo Night',
        startTime: '2026-08-30T18:00:00.000Z',
        endTime: '2026-08-30T21:00:00.000Z',
        timezone: 'America/New_York',
        chapter: { slug: 'boston', timezone: 'America/New_York' },
        meetingUrl: 'https://example.com/meeting',
        canViewPitch: true,
        canManagePitch: true,
        pitchPhase: 'VOTING',
        staff: [],
        pitchSessions: [
          {
            audienceCanReorder: false,
            votingEndTime: null,
            phase: 'VOTING',
            topProjectCount: 5,
            topPitchSec: 300,
            defaultPitchSec: 180,
            projects: [],
          },
        ],
      }),
    });

    render(<PitchEventPage eventId="evt-1" />);

    const joinMeeting = await screen.findByRole('link', {
      name: 'Join meeting',
    });
    const editEvent = screen.getByRole('button', { name: 'Edit Event' });
    const eventHeading = screen.getByRole('heading', {
      level: 1,
      name: 'Demo Night',
    });
    expect(joinMeeting).toHaveClass('px-4', 'py-2', 'text-sm');
    expect(editEvent).toHaveClass('px-4', 'py-2', 'text-sm');
    expect(eventHeading).toHaveClass(
      'min-w-0',
      '[overflow-wrap:anywhere]'
    );
    expect(eventHeading.parentElement).toHaveClass(
      'min-w-0',
      'lg:col-span-2'
    );
    expect(eventHeading.parentElement?.parentElement).toHaveClass(
      'lg:grid-cols-3',
      'lg:gap-6'
    );
    expect(
      screen.queryByRole('link', { name: 'Demo Night' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Voting Open')).not.toBeInTheDocument();
  });
});
