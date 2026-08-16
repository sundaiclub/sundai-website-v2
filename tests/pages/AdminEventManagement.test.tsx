import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();
const originalFetch = global.fetch;

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('../../src/app/components/Project', () => {
  return function MockProjectGrid() {
    return <div data-testid="project-grid">Project moderation grid</div>;
  };
});

type PageComponent = React.ComponentType;

const siteAdminUser = {
  id: 'hacker-site-admin',
  name: 'Site Admin',
  role: 'SITE_ADMIN',
  roles: ['SITE_ADMIN'],
};

const regularUser = {
  id: 'hacker-regular',
  name: 'Regular Hacker',
  role: 'HACKER',
  roles: ['HACKER'],
};

const chapters = [
  {
    id: 'chapter-boston',
    name: 'Sundai Boston',
    slug: 'boston',
    city: 'Boston',
    region: 'MA',
    country: 'US',
    timezone: 'America/New_York',
    accessMode: 'PUBLIC',
    status: 'ACTIVE',
    admins: [{ id: 'hacker-boston-admin', name: 'Boston Admin' }],
    members: [{ id: 'membership-1', status: 'ACTIVE' }],
  },
  {
    id: 'chapter-nyc',
    name: 'Sundai NYC',
    slug: 'nyc',
    city: 'New York',
    region: 'NY',
    country: 'US',
    timezone: 'America/New_York',
    accessMode: 'PRIVATE',
    status: 'PAUSED',
    admins: [],
    members: [],
  },
];

const templates = [
  {
    id: 'template-site',
    scope: 'SITE',
    name: 'Sundai Site Requirements',
    status: 'ACTIVE',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', required: true },
      { key: 'githubUrl', label: 'GitHub URL', required: false },
    ],
  },
  {
    id: 'template-boston',
    scope: 'CHAPTER',
    chapterId: 'chapter-boston',
    chapterName: 'Sundai Boston',
    name: 'Boston Chapter Questions',
    status: 'ACTIVE',
    fields: [
      { key: 'dietary', label: 'Dietary restrictions', required: false },
    ],
  },
];

const bans = [
  {
    id: 'ban-1',
    hackerId: 'hacker-banned',
    hackerName: 'Banned Hacker',
    publicReason: 'Policy violation',
    internalNote: 'Internal moderation context',
    status: 'ACTIVE',
    createdAt: '2026-05-25T12:00:00.000Z',
  },
];

const hackers = [
  { id: 'hacker-alice', name: 'Alice Hacker', email: 'alice@example.com' },
  { id: 'hacker-bob', name: 'Bob Builder', email: 'bob@example.com' },
];

const banFlags = [
  {
    id: 'flag-1',
    hackerId: 'hacker-flagged',
    hackerName: 'Flagged Hacker',
    chapterName: 'Sundai Boston',
    reason: 'Needs review',
    status: 'OPEN',
  },
];

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

function mockSiteAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: true,
    loading: false,
    userInfo: siteAdminUser,
  });
}

function mockNonSiteAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: regularUser,
  });
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

function mockAdminFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : 'url' in input
          ? input.url
          : input.toString();

    if (url.includes('/api/admin/ban-flags')) {
      return jsonResponse({ banFlags, flags: banFlags });
    }

    if (url.includes('/api/admin/bans')) {
      return jsonResponse({ bans, items: bans });
    }

    if (url.includes('/api/hackers')) {
      return jsonResponse(hackers);
    }

    if (url.includes('/api/application-templates/merged')) {
      return jsonResponse({
        fields: [...templates[0].fields, ...templates[1].fields],
      });
    }

    if (url.includes('/api/application-templates')) {
      return jsonResponse({ templates, items: templates });
    }

    if (url.includes('/api/chapters')) {
      return jsonResponse({ chapters, items: chapters });
    }

    return jsonResponse({});
  }) as jest.Mock;
}

function mockForbiddenFetches() {
  global.fetch = jest.fn(() =>
    jsonResponse(
      { error: 'You do not have permission to view this page.' },
      403
    )
  ) as jest.Mock;
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
    /you do not have permission/i,
    /access denied/i,
    /not authorized/i,
    /forbidden/i
  );
}

describe('event-management site-admin pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockAdminFetches();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('/admin', () => {
    it('renders the site-admin console links for delegated event management', async () => {
      mockSiteAdmin();
      const AdminPage = loadPage('/admin', '../../src/app/admin/page');

      render(<AdminPage />);

      expect(screen.getByRole('link', { name: /project/i })).toHaveAttribute(
        'href',
        '/admin/projects'
      );
      expect(screen.getByRole('link', { name: /chapters/i })).toHaveAttribute(
        'href',
        '/admin/chapters'
      );
      expect(
        screen.getByRole('link', { name: /application templates|templates/i })
      ).toHaveAttribute('href', '/admin/application-templates');
      expect(
        screen.getByRole('link', { name: /bans|global moderation/i })
      ).toHaveAttribute('href', '/admin/bans');
    });

    it('denies the console to non-site-admin users', async () => {
      mockNonSiteAdmin();
      mockForbiddenFetches();
      const AdminPage = loadPage('/admin', '../../src/app/admin/page');

      render(<AdminPage />);

      await expectAccessDenied();
      expect(
        screen.queryByRole('link', { name: /chapters/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /application templates|templates/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /bans|global moderation/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('/admin/chapters', () => {
    it('renders chapter list and management controls for site admins', async () => {
      mockSiteAdmin();
      const ChaptersPage = loadPage(
        '/admin/chapters',
        '../../src/app/admin/chapters/page'
      );

      render(<ChaptersPage />);

      await expectSomeText(/sundai boston/i, /boston/i);
      await expectSomeText(/sundai nyc/i);
      expect(
        screen.getAllByRole('button', { name: /create chapter|new chapter/i })
          .length
      ).toBeGreaterThan(0);
      const timezone = screen.getByLabelText(/timezone/i);
      expect(timezone.tagName).toBe('SELECT');
      expect(timezone).toHaveValue('America/New_York');
      expect(
        screen.getByRole('option', { name: /central.*america\/chicago/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: /london.*europe\/london/i })
      ).toBeInTheDocument();
      await expectSomeText(/public/i);
      await expectSomeText(/private/i);
      await expectSomeText(/settings/i);
      expect(
        screen.getByRole('link', { name: /sundai boston/i })
      ).toHaveAttribute('href', '/chapters/boston');
      expect(
        screen.getAllByRole('link', { name: /public page/i })[0]
      ).toHaveAttribute('href', '/chapters/boston');
      expect(
        screen.getAllByRole('link', { name: /settings/i })[0]
      ).toHaveAttribute('href', '/organizer/chapters/boston/settings');
      expect(
        screen.queryByRole('link', { name: /^events$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /edit sundai boston name/i })
      ).toBeInTheDocument();
    });

    it('edits a chapter name from the chapter list', async () => {
      mockSiteAdmin();
      global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : 'url' in input
              ? input.url
              : input.toString();

        if (
          url === '/api/chapters/chapter-boston' &&
          init?.method === 'PATCH'
        ) {
          return jsonResponse({
            ...chapters[0],
            name: 'Sundai Greater Boston',
          });
        }
        if (url === '/api/chapters') {
          return jsonResponse({ chapters, items: chapters });
        }
        return jsonResponse({});
      }) as jest.Mock;
      const ChaptersPage = loadPage(
        '/admin/chapters',
        '../../src/app/admin/chapters/page'
      );

      render(<ChaptersPage />);

      const editButton = await screen.findByRole('button', {
        name: /edit sundai boston name/i,
      });
      fireEvent.click(editButton);
      fireEvent.change(
        screen.getByRole('textbox', {
          name: /chapter name for sundai boston/i,
        }),
        { target: { value: 'Sundai Greater Boston' } }
      );
      fireEvent.click(screen.getByRole('button', { name: /save name/i }));

      await expectSomeText(/sundai greater boston/i);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chapters/chapter-boston',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Sundai Greater Boston' }),
        })
      );
    });

    it('denies chapter management to non-site-admin users', async () => {
      mockNonSiteAdmin();
      mockForbiddenFetches();
      const ChaptersPage = loadPage(
        '/admin/chapters',
        '../../src/app/admin/chapters/page'
      );

      render(<ChaptersPage />);

      await expectAccessDenied();
      expect(screen.queryByText(/sundai boston/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /create chapter|new chapter/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('/admin/application-templates', () => {
    it('renders site application template controls for site admins', async () => {
      mockSiteAdmin();
      const TemplatesPage = loadPage(
        '/admin/application-templates',
        '../../src/app/admin/application-templates/page'
      );

      render(<TemplatesPage />);

      await expectSomeText(/sundai site requirements/i, /site template/i);
      await expectSomeText(/name/i);
      await expectSomeText(/email/i);
      await expectSomeText(/boston chapter questions/i, /sundai boston/i);
      expect(
        screen.getAllByRole('button', { name: /save|update|create/i }).length
      ).toBeGreaterThan(0);
      await expectSomeText(/application preview/i);
    });

    it('denies application template management to non-site-admin users', async () => {
      mockNonSiteAdmin();
      mockForbiddenFetches();
      const TemplatesPage = loadPage(
        '/admin/application-templates',
        '../../src/app/admin/application-templates/page'
      );

      render(<TemplatesPage />);

      await expectAccessDenied();
      expect(
        screen.queryByText(/sundai site requirements/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /save|update|create/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('/admin/bans', () => {
    it('renders global ban and ban-flag controls for site admins', async () => {
      mockSiteAdmin();
      const BansPage = loadPage('/admin/bans', '../../src/app/admin/bans/page');

      render(<BansPage />);

      await expectSomeText(/banned hacker/i, /policy violation/i);
      await expectSomeText(/flagged hacker/i);
      expect(
        screen.getByRole('textbox', { name: /search/i })
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/hacker name/i)).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', {
          name: /create ban|ban hacker|add ban/i,
        }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /revoke/i }).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: /resolve/i }).length
      ).toBeGreaterThan(0);
    });

    it('shows matching hackers while typing and submits the selected hacker', async () => {
      mockSiteAdmin();
      const createdBan = {
        id: 'ban-created',
        hackerId: 'hacker-alice',
        hacker: { id: 'hacker-alice', name: 'Alice Hacker' },
        publicSafeReason: 'Policy violation',
        createdAt: '2026-05-25T12:00:00.000Z',
      };

      global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : 'url' in input
              ? input.url
              : input.toString();

        if (url.includes('/api/admin/ban-flags')) {
          return jsonResponse({ banFlags: [], flags: [] });
        }

        if (url.includes('/api/admin/bans') && init?.method === 'POST') {
          return jsonResponse(createdBan, 201);
        }

        if (url.includes('/api/admin/bans')) {
          return jsonResponse({ bans: [], items: [] });
        }

        if (url.includes('/api/hackers')) {
          return jsonResponse(hackers);
        }

        return jsonResponse({});
      }) as jest.Mock;

      const BansPage = loadPage('/admin/bans', '../../src/app/admin/bans/page');
      render(<BansPage />);

      await expectSomeText(/no active bans are listed/i);
      const input = screen.getByRole('textbox', {
        name: /search hacker by name/i,
      });
      fireEvent.change(input, { target: { value: 'Alice' } });
      await expectSomeText(/alice@example.com/i);
      expect(screen.getByRole('listbox')).toHaveClass('bg-gray-100');
      fireEvent.click(screen.getByRole('option', { name: /alice hacker/i }));
      fireEvent.click(screen.getByRole('button', { name: /create ban/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/bans',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ hackerId: 'hacker-alice' }),
          })
        );
      });
      await expectSomeText(/alice hacker/i);
    });

    it('denies global moderation details to non-site-admin users', async () => {
      mockNonSiteAdmin();
      mockForbiddenFetches();
      const BansPage = loadPage('/admin/bans', '../../src/app/admin/bans/page');

      render(<BansPage />);

      await expectAccessDenied();
      expect(screen.queryByText(/policy violation/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/internal moderation context/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /create ban|ban hacker|add ban/i })
      ).not.toBeInTheDocument();
    });
  });
});
