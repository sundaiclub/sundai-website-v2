import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { PublicEventCard } from '../../src/types/event-management';
import EventsPage from '../../src/app/events/page';

const mockUseTheme = jest.fn();
const mockRouterPush = jest.fn();
let currentSearchParams = new URLSearchParams();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/events',
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const publicEvents: PublicEventCard[] = [
  {
    id: 'event-boston-ai-build-night',
    slug: 'ai-build-night',
    chapterSlug: 'boston',
    chapterName: 'Sundai Boston',
    chapter: {
      id: 'chapter-boston',
      slug: 'boston',
      name: 'Sundai Boston',
      timezone: 'America/New_York',
    },
    title: 'Boston AI Build Night',
    publicLocation: 'Kendall Square',
    startTime: '2026-07-10T22:00:00.000Z',
    endTime: '2026-07-11T01:00:00.000Z',
    publicStatus: 'OPEN',
    viewerRegistrationStatus: 'PENDING',
  },
  {
    id: 'event-sf-agent-salon',
    slug: 'agent-salon',
    chapterSlug: 'san-francisco',
    chapterName: 'Sundai San Francisco',
    chapter: {
      id: 'chapter-san-francisco',
      slug: 'san-francisco',
      name: 'Sundai San Francisco',
      timezone: 'America/Los_Angeles',
    },
    title: 'Agent Salon',
    publicLocation: 'Mission District',
    startTime: '2026-07-12T23:30:00.000Z',
    endTime: '2026-07-13T02:00:00.000Z',
    publicStatus: 'WAITLIST_AVAILABLE',
    viewerRegistrationStatus: null,
  },
];

const chapters = [
  {
    id: 'chapter-boston',
    name: 'Sundai Boston',
    slug: 'boston',
    timezone: 'America/New_York',
  },
  {
    id: 'chapter-san-francisco',
    name: 'Sundai San Francisco',
    slug: 'san-francisco',
    timezone: 'America/Los_Angeles',
  },
];

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data)
      ),
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if ('url' in input) return input.url;
  return input.toString();
}

function mockEventsFetch(events: unknown[] = publicEvents) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url.includes('/api/chapters')) {
      return jsonResponse(chapters);
    }

    if (url.includes('/api/events')) {
      const request = new URL(url, 'http://localhost');
      const chapterSlug = request.searchParams.get('chapterSlug');
      const visibleEvents = chapterSlug
        ? events.filter(event => {
            return (
              typeof event === 'object' &&
              event !== null &&
              'chapterSlug' in event &&
              event.chapterSlug === chapterSlug
            );
          })
        : events;

      return jsonResponse(visibleEvents);
    }

    return jsonResponse({});
  }) as jest.Mock;
}

async function expectEventCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return heading.closest('article') ?? heading.parentElement ?? document.body;
}

async function chooseChapterFilter(chapterName: string) {
  const button = screen.queryByRole('button', {
    name: new RegExp(chapterName, 'i'),
  });
  if (button) {
    fireEvent.click(button);
    return;
  }

  const select = screen.queryByRole('combobox', { name: /chapter/i });
  if (select) {
    fireEvent.change(select, {
      target: {
        value: chapters.find(chapter => chapter.name === chapterName)?.slug,
      },
    });
    return;
  }

  throw new Error(`Expected an accessible chapter filter for ${chapterName}`);
}

function expectAllChaptersFilter() {
  const button = screen.queryByRole('button', { name: /all chapters/i });
  if (button) {
    expect(button).toBeInTheDocument();
    return;
  }

  const select = screen.queryByRole('combobox', { name: /chapter/i });
  if (select) {
    expect(
      within(select).getByRole('option', { name: /all chapters/i })
    ).toBeInTheDocument();
    return;
  }

  throw new Error('Expected an accessible all-chapters filter control');
}

describe('/events native public listing page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockEventsFetch();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  it('shows native published event listing cards with public fields and viewer status', async () => {
    render(<EventsPage />);

    expect(
      await screen.findByRole('heading', { name: /upcoming events/i })
    ).toBeInTheDocument();

    const bostonCard = await expectEventCard('Boston AI Build Night');
    expect(within(bostonCard).getByText(/sundai boston/i)).toBeInTheDocument();
    expect(within(bostonCard).getByText(/kendall square/i)).toBeInTheDocument();
    expect(within(bostonCard).getByText(/open/i)).toBeInTheDocument();
    expect(within(bostonCard).getByText(/pending/i)).toBeInTheDocument();

    const sfCard = await expectEventCard('Agent Salon');
    expect(
      within(sfCard).getByText(/sundai san francisco/i)
    ).toBeInTheDocument();
    expect(within(sfCard).getByText(/mission district/i)).toBeInTheDocument();
    expect(within(sfCard).getByText(/waitlist/i)).toBeInTheDocument();
  });

  it('renders chapter filter controls and narrows the listing by chapter', async () => {
    render(<EventsPage />);

    expect(
      await screen.findByRole('heading', { name: 'Boston AI Build Night' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Agent Salon' })
    ).toBeInTheDocument();
    expectAllChaptersFilter();

    await chooseChapterFilter('Sundai Boston');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Boston AI Build Night' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Agent Salon' })
      ).not.toBeInTheDocument();
    });
  });

  it('links every event card to its native public detail page', async () => {
    render(<EventsPage />);

    expect(
      await screen.findByRole('link', { name: /boston ai build night/i })
    ).toHaveAttribute('href', '/events/boston/ai-build-night');
    expect(screen.getByRole('link', { name: /agent salon/i })).toHaveAttribute(
      'href',
      '/events/san-francisco/agent-salon'
    );
  });

  it('shows an empty state when no upcoming published events are available', async () => {
    mockEventsFetch([]);

    render(<EventsPage />);

    expect(await screen.findByText(/no upcoming events/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /build night|agent salon/i })
    ).not.toBeInTheDocument();
  });
});
