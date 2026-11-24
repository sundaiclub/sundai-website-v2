import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PublicEventHero } from '@/app/components/EventHeroImage';
import type { PublicEventDetail } from '@/types/event-management';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

const event = {
  title: 'Test Hack',
  chapterName: 'Test Chapter',
  publicLocation: 'Cambridge, MA',
  startTime: '2026-12-06T15:00:00.000Z',
  endTime: null,
  timezone: 'America/New_York',
} as unknown as PublicEventDetail;

const address = '1 Example St, Cambridge, MA';

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
}

describe('PublicEventHero location', () => {
  it('shows the public location as plain text without an address', () => {
    render(<PublicEventHero event={event} />);

    expect(screen.getByText('Cambridge, MA')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the address to Google Maps on other devices', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/130.0');
    render(<PublicEventHero event={event} mapsAddress={address} />);

    expect(screen.getByRole('link', { name: /in maps/ })).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    );
  });

  it('links the address to Apple Maps on Apple devices', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<PublicEventHero event={event} mapsAddress={address} />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /in maps/ })).toHaveAttribute(
        'href',
        `https://maps.apple.com/?q=${encodeURIComponent(address)}`
      )
    );
  });
});
