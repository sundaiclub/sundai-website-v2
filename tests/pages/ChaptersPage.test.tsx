import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseParams = jest.fn();
const mockUseUser = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => '/chapters/boston',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
  SignInButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  UserButton: () => <div>User Button</div>,
}));

type PageComponent = React.ComponentType<{ params?: { chapterSlug: string } }>;

const signedOutUser = null;

const regularUser = {
  id: 'hacker-regular',
  clerkId: 'clerk-regular',
  name: 'Regular Hacker',
  email: 'regular@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [],
};

const activeMemberUser = {
  ...regularUser,
  id: 'hacker-member',
  clerkId: 'clerk-member',
  chapterMemberships: [
    {
      id: 'membership-boston-active',
      chapterId: 'chapter-boston',
      chapterSlug: 'boston',
      role: 'MEMBER',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
    },
  ],
};

const chapterAdminUser = {
  ...regularUser,
  id: 'hacker-chapter-admin',
  clerkId: 'clerk-chapter-admin',
  chapterMemberships: [
    {
      id: 'membership-boston-admin',
      chapterId: 'chapter-boston',
      chapterSlug: 'boston',
      role: 'ADMIN',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
    },
  ],
};

const invitedUser = {
  ...regularUser,
  id: 'hacker-invited',
  clerkId: 'clerk-invited',
  chapterMemberships: [
    {
      id: 'membership-cambridge-invited',
      chapterId: 'chapter-cambridge',
      chapterSlug: 'cambridge-private',
      role: 'MEMBER',
      status: 'INVITED',
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
    },
  ],
};

const siteAdminUser = {
  ...regularUser,
  id: 'hacker-site-admin',
  role: 'SITE_ADMIN',
  roles: ['SITE_ADMIN'],
};

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
  viewerMembership: null,
  memberships: [],
  nextEvent: {
    id: 'event-boston-demo-night',
    title: 'Boston Demo Night',
    slug: 'demo-night',
    startTime: '2026-07-18T22:00:00.000Z',
    publicLocation: 'Kendall Square',
  },
  upcomingEvents: [
    {
      id: 'event-boston-demo-night',
      title: 'Boston Demo Night',
      slug: 'demo-night',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      startsAt: '2026-06-18T22:00:00.000Z',
      publicLocation: 'Kendall Square',
    },
  ],
};

const sanFranciscoChapter = {
  id: 'chapter-san-francisco',
  name: 'Sundai San Francisco',
  slug: 'san-francisco',
  city: 'San Francisco',
  region: 'CA',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'West Coast builders and demos.',
  status: 'ACTIVE',
  accessMode: 'PUBLIC',
  viewerMembership: null,
  memberships: [],
  nextEvent: {
    id: 'event-sf-agent-salon',
    title: 'Agent Salon',
    slug: 'agent-salon',
    startTime: '2026-07-12T23:30:00.000Z',
    publicLocation: 'Mission District',
  },
  upcomingEvents: [
    {
      id: 'event-sf-agent-salon',
      title: 'Agent Salon',
      slug: 'agent-salon',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      startsAt: '2026-07-12T23:30:00.000Z',
      publicLocation: 'Mission District',
    },
  ],
};

const activeChapterDirectory = [bostonChapter, sanFranciscoChapter];

const bostonMemberChapter = {
  ...bostonChapter,
  viewerMembership: {
    id: 'membership-boston-active',
    role: 'MEMBER',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
  },
  memberships: [
    {
      id: 'membership-boston-active',
      hackerId: 'hacker-member',
      role: 'MEMBER',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
    },
  ],
};

const bostonAdminChapter = {
  ...bostonChapter,
  viewerMembership: {
    id: 'membership-boston-admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
  },
  memberships: [
    {
      id: 'membership-boston-admin',
      hackerId: 'hacker-chapter-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
    },
  ],
};

const cambridgePrivateChapter = {
  id: 'chapter-cambridge',
  name: 'Sundai Cambridge Private',
  slug: 'cambridge-private',
  city: 'Cambridge',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Invite-only research nights.',
  status: 'ACTIVE',
  accessMode: 'PRIVATE',
  viewerMembership: {
    id: 'membership-cambridge-invited',
    role: 'MEMBER',
    status: 'INVITED',
    notificationsAllowed: false,
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
  },
  memberships: [
    {
      id: 'membership-cambridge-invited',
      hackerId: 'hacker-invited',
      role: 'MEMBER',
      status: 'INVITED',
      notificationsAllowed: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
    },
  ],
  upcomingEvents: [
    {
      id: 'event-cambridge-roundtable',
      title: 'Private Research Roundtable',
      slug: 'research-roundtable',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      startsAt: '2026-06-25T22:00:00.000Z',
      publicLocation: 'Invite-only venue',
    },
  ],
};

const privateAustinChapter = {
  id: 'chapter-austin',
  name: 'Sundai Austin Private',
  slug: 'austin-private',
  city: 'Austin',
  region: 'TX',
  country: 'US',
  timezone: 'America/Chicago',
  description: 'This chapter should stay hidden from unauthorized users.',
  status: 'ACTIVE',
  accessMode: 'PRIVATE',
  viewerMembership: null,
  memberships: [],
  upcomingEvents: [],
};

function loadPage(route: string, modulePath: string): PageComponent {
  try {
    const mod = require(modulePath);
    if (!mod.default) {
      throw new Error('module did not export a default React component');
    }

    return mod.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Expected ${route} page module at ${modulePath}: ${message}`
    );
  }
}

function mockSignedOut() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: signedOutUser,
  });
  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  });
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
  });
}

function mockSignedIn(userInfo = regularUser) {
  mockUseUserContext.mockReturnValue({
    isAdmin: userInfo.role === 'SITE_ADMIN',
    loading: false,
    userInfo,
  });
  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: userInfo.clerkId,
      fullName: userInfo.name,
      emailAddresses: [{ emailAddress: userInfo.email }],
    },
  });
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId: userInfo.clerkId,
  });
}

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

function requestBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return {};
  return JSON.parse(init.body);
}

function visibleChaptersForCurrentUser() {
  const userInfo = mockUseUserContext().userInfo;
  if (!userInfo) return [bostonChapter];
  if (userInfo.role === 'SITE_ADMIN') {
    return [bostonChapter, cambridgePrivateChapter, privateAustinChapter];
  }
  if (userInfo.id === 'hacker-invited')
    return [bostonChapter, cambridgePrivateChapter];
  if (userInfo.id === 'hacker-member') return [bostonMemberChapter];
  if (userInfo.id === 'hacker-chapter-admin') return [bostonAdminChapter];
  return [bostonChapter];
}

function chapterForSlug(slug: string) {
  if (slug === 'boston' || slug === 'chapter-boston') {
    const userInfo = mockUseUserContext().userInfo;
    if (userInfo?.id === 'hacker-chapter-admin') return bostonAdminChapter;
    return userInfo?.id === 'hacker-member'
      ? bostonMemberChapter
      : bostonChapter;
  }
  if (slug === 'cambridge-private' || slug === 'chapter-cambridge') {
    const userInfo = mockUseUserContext().userInfo;
    if (userInfo?.id === 'hacker-invited' || userInfo?.role === 'SITE_ADMIN') {
      return cambridgePrivateChapter;
    }
    return null;
  }
  if (slug === 'austin-private' || slug === 'chapter-austin') {
    const userInfo = mockUseUserContext().userInfo;
    return userInfo?.role === 'SITE_ADMIN' ? privateAustinChapter : null;
  }
  return null;
}

function mockChapterFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = init?.method?.toUpperCase() ?? 'GET';

    if (url.includes('/api/events')) {
      const chapterSlug = url.includes('cambridge')
        ? 'cambridge-private'
        : 'boston';
      return jsonResponse(chapterForSlug(chapterSlug)?.upcomingEvents ?? []);
    }

    if (method === 'POST' && url.includes('/join')) {
      return jsonResponse(
        {
          id: 'membership-boston-new',
          chapterId: 'chapter-boston',
          hackerId: 'hacker-regular',
          role: 'MEMBER',
          status: 'ACTIVE',
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
        },
        201
      );
    }

    if (method === 'POST' && url.includes('/invites/accept')) {
      return jsonResponse({
        ...cambridgePrivateChapter.viewerMembership,
        status: 'ACTIVE',
        joinedAt: '2026-05-25T12:00:00.000Z',
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
      });
    }

    if (method === 'PATCH' && url.includes('/notifications')) {
      const body = requestBody(init);
      return jsonResponse({
        ...bostonMemberChapter.viewerMembership,
        ...body,
      });
    }

    if (url.includes('/api/chapters')) {
      const chapterMatch = url.match(/\/api\/chapters\/([^/?]+)/);
      if (chapterMatch) {
        const chapter = chapterForSlug(decodeURIComponent(chapterMatch[1]));
        if (!chapter) {
          return jsonResponse({ message: 'Not Found' }, 404);
        }
        return jsonResponse(chapter);
      }
      return jsonResponse({
        chapters: visibleChaptersForCurrentUser(),
        items: visibleChaptersForCurrentUser(),
      });
    }

    return jsonResponse({});
  }) as jest.Mock;
}

function mockDirectoryFetch(chapters: unknown[]) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url.includes('/api/chapters')) {
      return jsonResponse({ chapters, items: chapters });
    }

    return jsonResponse({});
  }) as jest.Mock;
}

async function expectSomeText(...patterns: RegExp[]) {
  await waitFor(() => {
    expect(
      patterns.some(pattern => screen.queryAllByText(pattern).length > 0)
    ).toBe(true);
  });
}

async function expectAccessDenied() {
  await expectSomeText(
    /not found/i,
    /access denied/i,
    /not authorized/i,
    /you do not have permission/i,
    /private chapter/i
  );
}

function renderDirectoryPage() {
  const ChaptersPage = loadPage('/chapters', '../../src/app/chapters/page');
  render(<ChaptersPage />);
}

function renderLandingPage(chapterSlug: string) {
  mockUseParams.mockReturnValue({ chapterSlug });
  const ChapterLandingPage = loadPage(
    '/chapters/[chapterSlug]',
    '../../src/app/chapters/[chapterSlug]/page'
  );
  render(<ChapterLandingPage params={{ chapterSlug }} />);
}

describe('chapter public directory and landing pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseParams.mockReturnValue({ chapterSlug: 'boston' });
    mockSignedOut();
    mockChapterFetches();
  });

  describe('/chapters', () => {
    it('renders active chapter cards with city, timezone, and next event links', async () => {
      mockDirectoryFetch(activeChapterDirectory);

      renderDirectoryPage();

      const bostonCardLink = await screen.findByRole('link', {
        name: /sundai boston/i,
      });
      const bostonCard =
        bostonCardLink.closest('article') ??
        bostonCardLink.closest('li') ??
        bostonCardLink;
      expect(within(bostonCard).getByText(/^Boston$/i)).toBeInTheDocument();
      expect(bostonCard).toHaveTextContent(/America\/New_York|Eastern/i);

      const sfCardLink = await screen.findByRole('link', {
        name: /sundai san francisco/i,
      });
      const sfCard =
        sfCardLink.closest('article') ?? sfCardLink.closest('li') ?? sfCardLink;
      expect(within(sfCard).getByText(/^San Francisco$/i)).toBeInTheDocument();
      expect(sfCard).toHaveTextContent(/America\/Los_Angeles|Pacific/i);

      expect(
        await screen.findByRole('link', { name: /boston demo night/i })
      ).toHaveAttribute('href', '/events/boston/demo-night');
      expect(
        screen.getByRole('link', { name: /agent salon/i })
      ).toHaveAttribute('href', '/events/san-francisco/agent-salon');
    });

    it('shows the chapter directory empty state when no active chapters are available', async () => {
      mockDirectoryFetch([]);

      renderDirectoryPage();

      expect(
        await screen.findByText(/no chapters are available/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /sundai boston/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /sundai san francisco/i })
      ).not.toBeInTheDocument();
    });

    it('shows active public chapters to signed-out visitors and hides unauthorized private chapters', async () => {
      mockSignedOut();

      renderDirectoryPage();

      await expectSomeText(/sundai boston/i);
      expect(
        screen.getByRole('link', { name: /sundai boston/i })
      ).toHaveAttribute('href', expect.stringContaining('/chapters/boston'));
      expect(screen.getByAltText(/sundai club logo/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/sundai cambridge private/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/sundai austin private/i)
      ).not.toBeInTheDocument();
    });

    it('shows invited private chapters and membership state to authorized signed-in users', async () => {
      mockSignedIn(invitedUser);

      renderDirectoryPage();

      await expectSomeText(/sundai boston/i);
      await expectSomeText(/sundai cambridge private/i);
      await expectSomeText(/invited/i);
      expect(
        screen.queryByText(/sundai austin private/i)
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /sundai cambridge private/i })
      ).toHaveAttribute(
        'href',
        expect.stringContaining('/chapters/cambridge-private')
      );
    });

    it('shows private chapters to site admins without exposing them to regular hackers', async () => {
      mockSignedIn(siteAdminUser);

      renderDirectoryPage();

      await expectSomeText(/sundai boston/i);
      await expectSomeText(/sundai cambridge private/i);
      await expectSomeText(/sundai austin private/i);
    });
  });

  describe('/chapters/[chapterSlug]', () => {
    it('renders public chapter details, upcoming events, and a join action for signed-in non-members', async () => {
      mockSignedIn(regularUser);

      renderLandingPage('boston');

      await expectSomeText(/sundai boston/i);
      await expectSomeText(/public builds and demos/i);
      await expectSomeText(/boston demo night/i);

      const joinButton = await screen.findByRole('button', { name: /join/i });
      fireEvent.click(joinButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(
            /\/api\/chapters\/(chapter-boston|boston)\/join/
          ),
          expect.objectContaining({ method: 'POST' })
        );
      });
      await expectSomeText(/active member|membership active|joined/i);
    });

    it('allows invited users to accept private chapter invitations', async () => {
      mockSignedIn(invitedUser);

      renderLandingPage('cambridge-private');

      await expectSomeText(/sundai cambridge private/i);
      await expectSomeText(/invited/i);

      const acceptButton = await screen.findByRole('button', {
        name: /accept.*invite|accept invitation|join private/i,
      });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(
            /\/api\/chapters\/(chapter-cambridge|cambridge-private)\/invites\/accept/
          ),
          expect.objectContaining({ method: 'POST' })
        );
      });
      await expectSomeText(/active member|membership active|joined/i);
    });

    it('shows active member state and updates per-chapter notification preferences', async () => {
      mockSignedIn(activeMemberUser);

      renderLandingPage('boston');

      await expectSomeText(/active member|membership active/i);
      expect(
        screen.queryByRole('dialog', { name: /notification preferences/i })
      ).not.toBeInTheDocument();

      fireEvent.click(
        await screen.findByRole('button', { name: /^preferences$/i })
      );

      expect(
        screen.getByRole('dialog', { name: /notification preferences/i })
      ).toBeInTheDocument();

      const notificationsControl = await screen.findByRole('checkbox', {
        name: /notifications|allow notifications/i,
      });
      fireEvent.click(notificationsControl);

      const emailControl = screen.getByRole('checkbox', {
        name: /email/i,
      });
      const smsControl = screen.getByRole('checkbox', {
        name: /sms|text/i,
      });

      expect(notificationsControl).not.toBeChecked();
      expect(emailControl).not.toBeChecked();
      expect(smsControl).not.toBeChecked();

      fireEvent.click(notificationsControl);

      expect(notificationsControl).toBeChecked();
      expect(emailControl).toBeChecked();
      expect(smsControl).not.toBeChecked();

      const saveButton = screen.getByRole('button', {
        name: /save.*notification|update.*notification|save preferences/i,
      });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(
            /\/api\/chapters\/(chapter-boston|boston)\/notifications/
          ),
          expect.objectContaining({
            method: 'PATCH',
            body: expect.any(String),
          })
        );
      });

      const notificationRequest = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) =>
          requestUrl(url).includes('/notifications') &&
          init?.method?.toUpperCase() === 'PATCH'
      );
      expect(JSON.parse(notificationRequest[1].body)).toEqual({
        notificationsAllowed: expect.any(Boolean),
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        smsConsentGranted: false,
        smsConsentVersion: '',
      });
    });

    it('requires explicit versioned SMS consent and sends consent evidence with preferences', async () => {
      process.env.NEXT_PUBLIC_SMS_CONSENT_COPY =
        'I consent to receive event text messages from Sundai. Message and data rates may apply.';
      process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION = '2026-07-10';
      mockSignedIn(activeMemberUser);

      renderLandingPage('boston');

      fireEvent.click(
        await screen.findByRole('button', { name: /^preferences$/i })
      );

      const smsControl = await screen.findByRole('checkbox', {
        name: /^sms|text notifications$/i,
      });
      fireEvent.click(smsControl);

      expect(
        screen.getByText(/message and data rates may apply/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/consent version 2026-07-10/i)
      ).toBeInTheDocument();

      const explicitConsent = screen.getByRole('checkbox', {
        name: /i consent to receive event text messages/i,
      });
      expect(explicitConsent).not.toBeChecked();
      fireEvent.click(explicitConsent);

      fireEvent.click(
        screen.getByRole('button', {
          name: /save.*notification|update.*notification|save preferences/i,
        })
      );

      await waitFor(() => {
        const notificationRequest = (global.fetch as jest.Mock).mock.calls.find(
          ([url, init]) =>
            requestUrl(url).includes('/notifications') &&
            init?.method?.toUpperCase() === 'PATCH'
        );
        expect(requestBody(notificationRequest?.[1])).toEqual(
          expect.objectContaining({
            smsNotificationsEnabled: true,
            smsConsentGranted: true,
            smsConsentVersion: '2026-07-10',
          })
        );
      });
    });

    it('shows a manage link to chapter admins', async () => {
      mockSignedIn(chapterAdminUser);

      renderLandingPage('boston');

      const manageLink = await screen.findByRole('link', { name: /manage/i });
      expect(manageLink).toHaveAttribute(
        'href',
        '/organizer/chapters/boston/settings'
      );
    });

    it('shows a manage link to site admins', async () => {
      mockSignedIn(siteAdminUser);

      renderLandingPage('boston');

      const manageLink = await screen.findByRole('link', { name: /manage/i });
      expect(manageLink).toHaveAttribute(
        'href',
        '/organizer/chapters/boston/settings'
      );
    });

    it('denies unauthorized users access to private chapter landing pages', async () => {
      mockSignedIn(regularUser);

      renderLandingPage('cambridge-private');

      await expectAccessDenied();
      expect(
        screen.queryByText(/invite-only research nights/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {
          name: /join|accept.*invite|notification/i,
        })
      ).not.toBeInTheDocument();
    });
  });
});
