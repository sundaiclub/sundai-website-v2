import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockUseTheme = jest.fn()
const mockUseUserContext = jest.fn()

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}))

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}))

jest.mock('../../src/app/components/Project', () => {
  return function MockProjectGrid() {
    return <div data-testid="project-grid">Project moderation grid</div>
  }
})

type PageComponent = React.ComponentType

const siteAdminUser = {
  id: 'hacker-site-admin',
  name: 'Site Admin',
  role: 'SITE_ADMIN',
  roles: ['SITE_ADMIN'],
}

const regularUser = {
  id: 'hacker-regular',
  name: 'Regular Hacker',
  role: 'HACKER',
  roles: ['HACKER'],
}

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
]

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
    fields: [{ key: 'dietary', label: 'Dietary restrictions', required: false }],
  },
]

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
]

const banFlags = [
  {
    id: 'flag-1',
    hackerId: 'hacker-flagged',
    hackerName: 'Flagged Hacker',
    chapterName: 'Sundai Boston',
    reason: 'Needs review',
    status: 'OPEN',
  },
]

function loadPage(route: string, modulePath: string): PageComponent {
  try {
    const mod = require(modulePath)
    if (!mod.default) {
      throw new Error('module did not export a default React component')
    }

    return mod.default
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Expected ${route} page module at ${modulePath}: ${message}`)
  }
}

function mockSiteAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: true,
    loading: false,
    userInfo: siteAdminUser,
  })
}

function mockNonSiteAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: regularUser,
  })
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  })
}

function mockAdminFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : 'url' in input
          ? input.url
          : input.toString()

    if (url.includes('/api/admin/ban-flags')) {
      return jsonResponse({ banFlags, flags: banFlags })
    }

    if (url.includes('/api/admin/bans')) {
      return jsonResponse({ bans, items: bans })
    }

    if (url.includes('/api/application-templates/merged')) {
      return jsonResponse({
        fields: [...templates[0].fields, ...templates[1].fields],
      })
    }

    if (url.includes('/api/application-templates')) {
      return jsonResponse({ templates, items: templates })
    }

    if (url.includes('/api/chapters')) {
      return jsonResponse({ chapters, items: chapters })
    }

    return jsonResponse({})
  }) as jest.Mock
}

function mockForbiddenFetches() {
  global.fetch = jest.fn(() =>
    jsonResponse({ error: 'You do not have permission to view this page.' }, 403),
  ) as jest.Mock
}

async function expectSomeText(...patterns: RegExp[]) {
  await waitFor(() => {
    expect(
      patterns.some((pattern) => screen.queryAllByText(pattern).length > 0),
    ).toBe(true)
  })
}

async function expectAccessDenied() {
  await expectSomeText(
    /you do not have permission/i,
    /access denied/i,
    /not authorized/i,
    /forbidden/i,
  )
}

describe('event-management site-admin pages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTheme.mockReturnValue({ isDarkMode: false })
    mockAdminFetches()
  })

  describe('/admin', () => {
    it('renders the site-admin console links for delegated event management', async () => {
      mockSiteAdmin()
      const AdminPage = loadPage('/admin', '../../src/app/admin/page')

      render(<AdminPage />)

      expect(
        screen.getByRole('link', { name: /project/i }),
      ).toHaveAttribute('href', '/admin/projects')
      expect(
        screen.getByRole('link', { name: /chapters/i }),
      ).toHaveAttribute('href', '/admin/chapters')
      expect(
        screen.getByRole('link', { name: /application templates|templates/i }),
      ).toHaveAttribute('href', '/admin/application-templates')
      expect(
        screen.getByRole('link', { name: /bans|global moderation/i }),
      ).toHaveAttribute('href', '/admin/bans')
    })

    it('denies the console to non-site-admin users', async () => {
      mockNonSiteAdmin()
      mockForbiddenFetches()
      const AdminPage = loadPage('/admin', '../../src/app/admin/page')

      render(<AdminPage />)

      await expectAccessDenied()
      expect(screen.queryByRole('link', { name: /chapters/i })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /application templates|templates/i }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /bans|global moderation/i })).not.toBeInTheDocument()
    })
  })

  describe('/admin/chapters', () => {
    it('renders chapter list and management controls for site admins', async () => {
      mockSiteAdmin()
      const ChaptersPage = loadPage(
        '/admin/chapters',
        '../../src/app/admin/chapters/page',
      )

      render(<ChaptersPage />)

      await expectSomeText(/sundai boston/i, /boston/i)
      await expectSomeText(/sundai nyc/i)
      expect(
        screen.getAllByRole('button', { name: /create chapter|new chapter/i })
          .length,
      ).toBeGreaterThan(0)
      await expectSomeText(/public/i)
      await expectSomeText(/private/i)
      await expectSomeText(/admins?|manage admins/i)
    })

    it('denies chapter management to non-site-admin users', async () => {
      mockNonSiteAdmin()
      mockForbiddenFetches()
      const ChaptersPage = loadPage(
        '/admin/chapters',
        '../../src/app/admin/chapters/page',
      )

      render(<ChaptersPage />)

      await expectAccessDenied()
      expect(screen.queryByText(/sundai boston/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /create chapter|new chapter/i })).not.toBeInTheDocument()
    })
  })

  describe('/admin/application-templates', () => {
    it('renders site application template controls for site admins', async () => {
      mockSiteAdmin()
      const TemplatesPage = loadPage(
        '/admin/application-templates',
        '../../src/app/admin/application-templates/page',
      )

      render(<TemplatesPage />)

      await expectSomeText(/sundai site requirements/i, /site template/i)
      await expectSomeText(/name/i)
      await expectSomeText(/email/i)
      await expectSomeText(/boston chapter questions/i, /sundai boston/i)
      expect(
        screen.getAllByRole('button', { name: /save|update|create/i }).length,
      ).toBeGreaterThan(0)
      await expectSomeText(/preview merged|merged preview|composed/i)
    })

    it('denies application template management to non-site-admin users', async () => {
      mockNonSiteAdmin()
      mockForbiddenFetches()
      const TemplatesPage = loadPage(
        '/admin/application-templates',
        '../../src/app/admin/application-templates/page',
      )

      render(<TemplatesPage />)

      await expectAccessDenied()
      expect(screen.queryByText(/sundai site requirements/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /save|update|create/i })).not.toBeInTheDocument()
    })
  })

  describe('/admin/bans', () => {
    it('renders global ban and ban-flag controls for site admins', async () => {
      mockSiteAdmin()
      const BansPage = loadPage('/admin/bans', '../../src/app/admin/bans/page')

      render(<BansPage />)

      await expectSomeText(/banned hacker/i, /policy violation/i)
      await expectSomeText(/flagged hacker/i)
      expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
      expect(
        screen.getAllByRole('button', { name: /create ban|ban hacker|add ban/i })
          .length,
      ).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: /revoke/i }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: /resolve/i }).length).toBeGreaterThan(0)
    })

    it('denies global moderation details to non-site-admin users', async () => {
      mockNonSiteAdmin()
      mockForbiddenFetches()
      const BansPage = loadPage('/admin/bans', '../../src/app/admin/bans/page')

      render(<BansPage />)

      await expectAccessDenied()
      expect(screen.queryByText(/policy violation/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/internal moderation context/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /create ban|ban hacker|add ban/i })).not.toBeInTheDocument()
    })
  })
})
