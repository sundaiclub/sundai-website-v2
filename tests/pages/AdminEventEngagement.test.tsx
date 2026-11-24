import React from 'react';
import { render, screen, within } from '@testing-library/react';
import AdminEventEngagementPage from '@/app/admin/event-engagement/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import type { EventEngagementReport } from '@/types/event-engagement';

const mockUseUserContext = jest.fn();

jest.mock('@/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

const report: EventEngagementReport = {
  generatedAt: '2026-11-24T12:00:00.000Z',
  lastWeekStart: '2026-11-17T12:00:00.000Z',
  minRsvps: 30,
  chapters: [
    {
      chapterId: 'boston',
      chapterName: 'Sundai Boston',
      rsvps: 180,
      rsvpBuilders: 44,
      builtRate: 44 / 180,
      rankedEvents: 2,
      events: [
        {
          eventId: 'medicine',
          title: 'AI 4 Next Gen Medicine',
          startTime: '2026-08-23T14:00:00.000Z',
          rsvps: 100,
          projects: 17,
          presented: 16,
          rsvpBuilders: 40,
          builtRate: 0.4,
          rank: 1,
          isLastWeek: false,
        },
        {
          eventId: 'worlds',
          title: 'Building 3D Worlds',
          startTime: '2026-11-22T15:00:00.000Z',
          rsvps: 80,
          projects: 14,
          presented: 11,
          rsvpBuilders: 4,
          builtRate: 0.05,
          rank: 2,
          isLastWeek: true,
        },
      ],
    },
    {
      chapterId: 'sf',
      chapterName: 'Sundai San Francisco',
      rsvps: 0,
      rsvpBuilders: 0,
      builtRate: null,
      rankedEvents: 0,
      events: [],
    },
  ],
};

function renderPage() {
  return render(
    <ThemeProvider>
      <AdminEventEngagementPage />
    </ThemeProvider>
  );
}

describe('AdminEventEngagementPage', () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => report });
  });

  it('shows each chapter and highlights last week', async () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: true,
      loading: false,
      userInfo: { name: 'Admin' },
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Sundai Boston' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sundai San Francisco' })
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/event-engagement');

    const lastWeek = screen
      .getByRole('heading', { name: 'Last week' })
      .closest('section') as HTMLElement;
    expect(
      within(lastWeek).getByText('Building 3D Worlds')
    ).toBeInTheDocument();
    expect(
      within(lastWeek).getByText(/4 of 80 RSVPs built a project · #2 of 2/)
    ).toBeInTheDocument();

    const highlightedRow = screen
      .getAllByRole('row')
      .find(row => within(row).queryByText('Last week'));
    expect(highlightedRow).toHaveTextContent('Building 3D Worlds');
  });

  it('does not load the report for users who are not site admins', () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: { name: 'Member' },
    });

    renderPage();

    expect(
      screen.getByText('You do not have permission to view this page.')
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
