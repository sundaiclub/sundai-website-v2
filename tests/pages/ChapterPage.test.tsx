import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

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
  happeningNowEvents: [
    {
      id: 'event-boston-live-build',
      title: 'Boston Live Build',
      slug: 'live-build',
      chapterSlug: 'boston',
      applicationCount: 12,
      startTime: '2026-07-10T18:00:00.000Z',
      endTime: '2026-07-11T01:00:00.000Z',
      publicLocation: 'Kendall Square',
    },
  ],
  upcomingEvents: [
    {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      slug: 'demo-night',
      chapterSlug: 'boston',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      applicationCount: 18,
      startTime: '2026-07-10T22:00:00.000Z',
      publicLocation: 'Kendall Square',
    },
    {
      id: 'event-boston-agent-jam',
      title: 'Boston Agent Jam',
      slug: 'agent-jam',
      chapterSlug: 'boston',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      applicationCount: 1,
      startTime: '2026-07-17T22:00:00.000Z',
      publicLocation: 'The Foundry',
    },
  ],
  previousEvents: [
    {
      id: 'event-boston-spring-demo',
      title: 'Boston Spring Demo',
      slug: 'spring-demo',
      chapterSlug: 'boston',
      applicationCount: 24,
      startTime: '2026-05-15T22:00:00.000Z',
      publicLocation: 'Central Square',
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

describe('/chapters/[chapterSlug] public chapter page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockSignedOut();
    mockChapterFetch();
  });

  it('renders the public chapter description without exposing provider internals', async () => {
    renderChapterPage();

    const heading = await screen.findByRole('heading', {
      name: /sundai boston/i,
    });
    const titleRow = heading.parentElement as HTMLElement;
    const description = screen.getByText(
      /public builds and demos for boston hackers/i
    );

    expect(within(titleRow).getByText('PUBLIC')).toBeInTheDocument();
    expect(within(titleRow).getByText('Not joined')).toBeInTheDocument();
    expect(description).toHaveClass('text-lg', 'sm:text-xl');

    expect(
      screen.getByRole('tab', { name: /preferences/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/mailchimp-audience-42/i)
    ).not.toBeInTheDocument();
    expect(screen.getByAltText(/sundai boston chapter/i)).toHaveAttribute(
      'src',
      expect.stringContaining('sundai_logo_light_horizontal.svg')
    );
  });

  it('shows chapter and event artwork with a Sundai fallback for missing images', async () => {
    mockChapterFetch({
      ...bostonChapter,
      heroImage: {
        id: 'chapter-image',
        url: 'https://cdn.example.com/chapter.webp',
        alt: 'Boston chapter mark',
      },
      upcomingEvents: [
        {
          ...bostonChapter.upcomingEvents[0],
          image: {
            id: 'event-image',
            url: 'https://cdn.example.com/event.webp',
            alt: 'Demo Night artwork',
          },
        },
        bostonChapter.upcomingEvents[1],
      ],
    });

    renderChapterPage();

    const chapterImage = await screen.findByAltText('Boston chapter mark');
    const chapterOverview = screen.getByRole('region', {
      name: 'Chapter overview',
    });

    expect(chapterOverview).toHaveClass('md:grid-cols-2');
    expect(chapterOverview).toHaveClass('md:items-center');
    expect(chapterImage).toHaveClass('object-contain');
    expect(chapterImage).toHaveAttribute(
      'src',
      'https://cdn.example.com/chapter.webp'
    );
    expect(screen.getByAltText('Demo Night artwork')).toHaveAttribute(
      'src',
      'https://cdn.example.com/event.webp'
    );
    expect(screen.getByAltText('Boston Agent Jam event')).toHaveAttribute(
      'src',
      expect.stringContaining('sundai_logo_light_horizontal.svg')
    );
  });

  it('switches between Events, Projects, and Preferences tabs', async () => {
    mockChapterFetch({
      ...bostonChapter,
      viewerMembership: {
        id: 'membership-active',
        chapterId: 'chapter-boston',
        hackerId: 'hacker-member',
        role: 'MEMBER',
        status: 'ACTIVE',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
      },
      topProjectsThisWeek: [
        {
          id: 'project-boston-agent',
          title: 'Boston Agent Toolkit',
          preview: 'A toolkit built at Demo Night.',
          launchLead: { id: 'hacker-lead', name: 'Alex Builder' },
          thumbnail: null,
          likeCount: 8,
        },
      ],
      topProjectsAllTime: [
        {
          id: 'project-boston-classic',
          title: 'Boston Build Classic',
          preview: 'A longtime chapter favorite.',
          launchLead: { id: 'hacker-classic', name: 'Sam Maker' },
          thumbnail: null,
          likeCount: 32,
        },
      ],
    });

    renderChapterPage();

    const eventsTab = await screen.findByRole('tab', { name: 'Events' });
    const projectsTab = screen.getByRole('tab', { name: 'Projects' });
    const preferencesTab = screen.getByRole('tab', { name: 'Preferences' });
    expect(eventsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(projectsTab);
    expect(projectsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(/upcoming events/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /top this week/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /top all time/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view project boston agent toolkit/i })
    ).toHaveAttribute('href', '/projects/project-boston-agent');
    expect(
      screen.getByRole('link', { name: /view project boston build classic/i })
    ).toHaveAttribute('href', '/projects/project-boston-classic');

    fireEvent.click(preferencesTab);
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(/top this week/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /notification preferences/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /leave chapter/i })
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole('link', { name: /edit boston demo night/i })
    ).not.toBeInTheDocument();
    expect(
      within(demoNight).getByText(
        `Kendall Square · ${new Date(
          '2026-07-10T22:00:00.000Z'
        ).toLocaleDateString()}`
      )
    ).toBeInTheDocument();
    expect(
      within(agentJam).getByText(
        `The Foundry · ${new Date(
          '2026-07-17T22:00:00.000Z'
        ).toLocaleDateString()}`
      )
    ).toBeInTheDocument();
    expect(
      within(demoNight).getByText('18 people applied')
    ).toBeInTheDocument();
    expect(within(agentJam).getByText('1 person applied')).toBeInTheDocument();
    expect(demoNight.closest('div.grid')).toHaveClass(
      'sm:grid-cols-2',
      'lg:grid-cols-3'
    );
    expect(demoNight.closest('div.grid')).not.toHaveClass('max-w-2xl');
  });

  it('shows previous events beneath upcoming events with native event links', async () => {
    renderChapterPage();

    const upcomingHeading = await screen.findByRole('heading', {
      name: /upcoming events/i,
    });
    const previousHeading = screen.getByRole('heading', {
      name: /previous events/i,
    });
    const previousEventsGrid = previousHeading
      .closest('section')
      ?.querySelector('div.grid');

    expect(previousEventsGrid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    expect(previousEventsGrid).not.toHaveClass('max-w-2xl');
    expect(
      upcomingHeading.compareDocumentPosition(previousHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const previousEvent = await screen.findByRole('link', {
      name: /boston spring demo/i,
    });
    expect(previousEvent).toHaveAttribute('href', '/events/boston/spring-demo');
    expect(
      within(previousEvent).getByText(
        `Central Square · ${new Date(
          '2026-05-15T22:00:00.000Z'
        ).toLocaleDateString()}`
      )
    ).toBeInTheDocument();
  });

  it('shows events that are happening now at the top of the public event groups', async () => {
    renderChapterPage();

    const happeningNowHeading = await screen.findByRole('heading', {
      name: /happening now/i,
    });
    const upcomingHeading = screen.getByRole('heading', {
      name: /upcoming events/i,
    });
    expect(
      happeningNowHeading.compareDocumentPosition(upcomingHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(
      screen.getByRole('link', { name: /boston live build/i })
    ).toHaveAttribute('href', '/events/boston/live-build');
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
    const chapterActions = screen.getByLabelText('Chapter actions');
    expect(chapterActions).toHaveClass('ml-auto');
    expect(
      within(chapterActions).getByRole('link', { name: /new event/i })
    ).toHaveAttribute('href', '/organizer/events/new?chapterId=chapter-boston');
    expect(
      screen.getByRole('link', { name: /edit boston demo night/i })
    ).toHaveAttribute(
      'href',
      '/organizer/events/event-boston-demo-night/settings'
    );
    expect(
      screen.getByRole('link', { name: /edit boston agent jam/i })
    ).toHaveAttribute(
      'href',
      '/organizer/events/event-boston-agent-jam/settings'
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
    const pendingEventLink = screen.getByRole('link', {
      name: /boston draft night/i,
    });
    expect(pendingEventLink).toHaveAttribute(
      'href',
      '/organizer/events/event-boston-draft-night/settings'
    );
    expect(within(pendingEventLink).getByText(/^TBD · /)).toBeInTheDocument();
    expect(within(pendingEventLink).getByText('DRAFT')).toBeInTheDocument();
    expect(within(pendingEventLink).getByText('PUBLIC')).toBeInTheDocument();
    expect(pendingEventLink.closest('div.grid')).toHaveClass(
      'sm:grid-cols-2',
      'lg:grid-cols-3'
    );
    expect(pendingEventLink.closest('div.grid')).not.toHaveClass('max-w-2xl');
  });

  it('does not show pending chapter events to signed-out visitors even when public admin memberships are present', async () => {
    mockChapterFetch({
      ...bostonChapter,
      viewerMembership: null,
      memberships: [
        {
          id: 'membership-public-admin',
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

    expect(
      await screen.findByRole('heading', { name: /sundai boston/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /pending events/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /boston draft night/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^manage$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /new event/i })
    ).not.toBeInTheDocument();
  });
});
