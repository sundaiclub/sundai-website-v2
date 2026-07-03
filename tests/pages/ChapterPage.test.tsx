import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import ChapterLandingPage from '../../src/app/chapters/[chapterSlug]/page';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

const bostonChapter = {
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Public builds and demos for Boston hackers.',
  status: 'ACTIVE',
  accessMode: 'PUBLIC',
  mailingListName: 'Boston builders list',
  mailingListExternalId: 'mailchimp-audience-42',
  viewerMembership: null,
  memberships: [],
  upcomingEvents: [
    {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      slug: 'demo-night',
      chapterSlug: 'boston',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      startsAt: '2026-07-10T22:00:00.000Z',
      publicLocation: 'Kendall Square',
    },
    {
      id: 'event-boston-agent-jam',
      title: 'Boston Agent Jam',
      slug: 'agent-jam',
      chapterSlug: 'boston',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      startsAt: '2026-07-17T22:00:00.000Z',
      publicLocation: 'The Foundry',
    },
  ],
  pendingEvents: [],
};

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

function mockChapterFetch(chapter: unknown = bostonChapter) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url.includes('/api/chapters/boston')) {
      return jsonResponse(chapter);
    }

    return jsonResponse({ message: 'Not Found' }, 404);
  }) as jest.Mock;
}

function mockSignedOut() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: null,
  });
}

function renderChapterPage() {
  render(<ChapterLandingPage params={{ chapterSlug: 'boston' }} />);
}

function findMailingListAction() {
  return (
    screen.queryByRole('link', {
      name: /join.*mailing|subscribe|mailing list/i,
    }) ??
    screen.queryByRole('button', {
      name: /join.*mailing|subscribe|mailing list/i,
    })
  );
}

describe('/chapters/[chapterSlug] public chapter page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockSignedOut();
    mockChapterFetch();
  });

  it('renders the public chapter description and mailing-list CTA without exposing provider internals', async () => {
    renderChapterPage();

    expect(
      await screen.findByRole('heading', { name: /sundai boston/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/public builds and demos for boston hackers/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/boston builders list/i)).toBeInTheDocument();
      expect(findMailingListAction()).toBeInTheDocument();
    });
    expect(screen.queryByText(/mailchimp-audience-42/i)).not.toBeInTheDocument();
  });

  it('links each upcoming event to its native public event detail page', async () => {
    renderChapterPage();

    const demoNight = await screen.findByRole('link', {
      name: /boston demo night/i,
    });
    const agentJam = screen.getByRole('link', {
      name: /boston agent jam/i,
    });

    expect(demoNight).toHaveAttribute('href', '/events/boston/demo-night');
    expect(agentJam).toHaveAttribute('href', '/events/boston/agent-jam');
  });

  it('shows manage and new event actions to chapter admins', async () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: { id: 'hacker-admin' },
    });
    mockChapterFetch({
      ...bostonChapter,
      viewerMembership: {
        id: 'membership-admin',
        chapterId: 'chapter-boston',
        hackerId: 'hacker-admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      memberships: [
        {
          id: 'membership-admin',
          chapterId: 'chapter-boston',
          hackerId: 'hacker-admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      ],
    });

    renderChapterPage();

    expect(
      await screen.findByRole('link', { name: /^manage$/i })
    ).toHaveAttribute('href', '/organizer/chapters/boston/settings');
    expect(screen.getByRole('link', { name: /new event/i })).toHaveAttribute(
      'href',
      '/organizer/events/new?chapterId=chapter-boston'
    );
  });

  it('shows pending chapter events to chapter admins above upcoming events', async () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: { id: 'hacker-admin' },
    });
    mockChapterFetch({
      ...bostonChapter,
      viewerMembership: {
        id: 'membership-admin',
        chapterId: 'chapter-boston',
        hackerId: 'hacker-admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      memberships: [
        {
          id: 'membership-admin',
          chapterId: 'chapter-boston',
          hackerId: 'hacker-admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      ],
      pendingEvents: [
        {
          id: 'event-boston-draft-night',
          title: 'Boston Draft Night',
          slug: 'draft-night',
          status: 'DRAFT',
          visibility: 'PUBLIC',
          startTime: '2026-07-03T22:00:00.000Z',
          publicLocation: 'TBD',
        },
      ],
    });

    renderChapterPage();

    const pendingHeading = await screen.findByRole('heading', {
      name: /pending events/i,
    });
    const upcomingHeading = screen.getByRole('heading', {
      name: /upcoming events/i,
    });
    expect(
      pendingHeading.compareDocumentPosition(upcomingHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /boston draft night/i })
    ).toHaveAttribute(
      'href',
      '/organizer/events/event-boston-draft-night/settings'
    );
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });
});
