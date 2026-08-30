import { fireEvent, render, screen } from '@testing-library/react';
import PitchLandingClient from '@/app/pitch/PitchLandingClient';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

describe('PitchLandingClient', () => {
  it('shows minimal event cards and opens the shared project chooser', () => {
    render(
      <ThemeProvider>
        <PitchLandingClient
          events={[
            {
              id: 'event-1',
              title: 'Boston Build Night',
              chapterName: 'Sundai Boston',
              chapterSlug: 'boston',
              slug: 'build-night',
            },
          ]}
        />
      </ThemeProvider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: /boston build night/i })
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Add a project');
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute(
      'href',
      expect.stringContaining(
        'returnTo=%2Fevents%2Fboston%2Fbuild-night%3Ftab%3Dpitch'
      )
    );
  });

  it('shows the agreed empty state', () => {
    render(
      <ThemeProvider>
        <PitchLandingClient events={[]} />
      </ThemeProvider>
    );

    expect(
      screen.getByText('You are not a part of any active events right now.')
    ).toBeInTheDocument();
  });
});
