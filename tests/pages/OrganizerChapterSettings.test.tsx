import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const mockUseTheme = jest.fn()
const mockUseUserContext = jest.fn()
const mockUseParams = jest.fn()

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}))

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}))

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => '/organizer/chapters/boston/settings',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}))

type PageComponent = React.ComponentType<{ params?: { chapterSlug: string } }>

const chapterAdminUser = {
  id: 'hacker-chapter-admin',
  clerkId: 'clerk-chapter-admin',
  name: 'Chapter Admin',
  email: 'chapter-admin@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [
    {
      chapterId: 'chapter-boston',
      chapterSlug: 'boston',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  ],
}

const regularUser = {
  id: 'hacker-regular',
  clerkId: 'clerk-regular',
  name: 'Regular Hacker',
  email: 'regular@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [],
}

const chapter = {
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Boston chapter operations',
  status: 'ACTIVE',
  accessMode: 'PRIVATE',
  defaultDeclineMessage: 'Thanks for applying. Please try another Sundai Boston meetup.',
  mailingListName: 'boston-organizers',
  memberships: [
    {
      id: 'membership-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      hacker: {
        id: 'hacker-chapter-admin',
        name: 'Chapter Admin',
        email: 'chapter-admin@example.com',
      },
    },
  ],
  admins: [
    {
      id: 'membership-admin',
      hacker: {
        id: 'hacker-chapter-admin',
        name: 'Chapter Admin',
        email: 'chapter-admin@example.com',
      },
    },
  ],
}

const members = [
  {
    id: 'membership-admin',
    chapterId: chapter.id,
    hackerId: 'hacker-chapter-admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    hacker: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
  },
  {
    id: 'membership-member',
    chapterId: chapter.id,
    hackerId: 'hacker-active-member',
    role: 'MEMBER',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
    hacker: {
      id: 'hacker-active-member',
      name: 'Active Member',
      email: 'member@example.com',
    },
  },
  {
    id: 'membership-invited',
    chapterId: chapter.id,
    hackerId: 'hacker-invited',
    role: 'MEMBER',
    status: 'INVITED',
    notificationsAllowed: false,
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
    invitedBy: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
    hacker: {
      id: 'hacker-invited',
      name: 'Invited Hacker',
      email: 'invited@example.com',
    },
  },
]

const templates = [
  {
    id: 'template-site',
    scope: 'SITE',
    name: 'Site required questions',
    isActive: true,
    fieldsJson: [
      { id: 'name', key: 'name', label: 'Name', type: 'TEXT', required: true },
      { id: 'email', key: 'email', label: 'Email', type: 'EMAIL', required: true },
    ],
  },
  {
    id: 'template-chapter-boston',
    scope: 'CHAPTER',
    chapterId: chapter.id,
    name: 'Boston chapter application',
    isActive: true,
    fieldsJson: [
      {
        id: 'build_goal',
        key: 'build_goal',
        label: 'What are you hoping to build?',
        type: 'LONG_TEXT',
        required: false,
      },
    ],
  },
]

const banFlags = [
  {
    id: 'flag-boston-review',
    chapterId: chapter.id,
    hackerId: 'hacker-flagged',
    reason: 'Repeated no-show pattern',
    status: 'OPEN',
    hacker: {
      id: 'hacker-flagged',
      name: 'Flagged Hacker',
      email: 'flagged@example.com',
    },
    createdBy: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
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

function mockChapterAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: chapterAdminUser,
  })
}

function mockUnauthorizedUser() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: regularUser,
  })
}

function mockLoadingUser() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: true,
    userInfo: null,
  })
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(
      typeof data === 'string' ? data : JSON.stringify(data),
    ),
  })
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if ('url' in input) return input.url
  return input.toString()
}

function mockOrganizerFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input)

    if (url.includes('/members')) {
      return jsonResponse(members)
    }

    if (url.includes('/invites')) {
      return jsonResponse(members.filter((member) => member.status === 'INVITED'))
    }

    if (url.includes('/ban-flags')) {
      return jsonResponse(banFlags)
    }

    if (url.includes('/application-templates/merged')) {
      return jsonResponse({
        fields: [
          ...templates[0].fieldsJson,
          ...templates[1].fieldsJson,
        ],
      })
    }

    if (url.includes('/application-templates')) {
      return jsonResponse(templates)
    }

    if (/\/api\/chapters\/[^/?]+/.test(url)) {
      return jsonResponse(chapter)
    }

    if (url.includes('/api/chapters')) {
      return jsonResponse([chapter])
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

function renderSettingsPage() {
  const OrganizerChapterSettingsPage = loadPage(
    '/organizer/chapters/[chapterSlug]/settings',
    '../../src/app/organizer/chapters/[chapterSlug]/settings/page',
  )

  render(<OrganizerChapterSettingsPage params={{ chapterSlug: 'boston' }} />)
}

describe('/organizer/chapters/[chapterSlug]/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTheme.mockReturnValue({ isDarkMode: false })
    mockUseParams.mockReturnValue({ chapterSlug: 'boston' })
    mockOrganizerFetches()
  })

  it('renders the chapter settings organizer surface for chapter admins', async () => {
    mockChapterAdmin()

    renderSettingsPage()

    await expectSomeText(/sundai boston/i, /chapter settings/i)
    await expectSomeText(/private/i, /active/i)
    await expectSomeText(/chapter admin/i)
    await expectSomeText(/active member/i)
    await expectSomeText(/invited hacker/i, /invitations?/i)
    await expectSomeText(/admins?/i)
    await expectSomeText(/members?/i)
    await expectSomeText(/notification/i)
    await expectSomeText(/ban flags?/i, /flagged hacker/i, /repeated no-show pattern/i)
    await expectSomeText(
      /boston chapter application/i,
      /what are you hoping to build/i,
      /application template/i,
    )
    await expectSomeText(
      /declined-user message/i,
      /default decline/i,
      /thanks for applying/i,
    )

    expect(
      screen.getAllByRole('button', { name: /save|update|invite|remove|revoke|add/i })
        .length,
    ).toBeGreaterThan(0)
  })

  it('denies the organizer settings surface to users who do not manage the chapter', async () => {
    mockUnauthorizedUser()
    mockForbiddenFetches()

    renderSettingsPage()

    await expectAccessDenied()
    expect(screen.queryByText(/active member/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invited hacker/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/repeated no-show pattern/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/thanks for applying/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /save|update|invite|remove|revoke|add/i }),
    ).not.toBeInTheDocument()
  })

  it('shows loading instead of access denied while auth is still resolving', async () => {
    mockLoadingUser()
    mockForbiddenFetches()

    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
    expect(
      screen.queryByText('You do not have permission to view this page.'),
    ).not.toBeInTheDocument()
  })
})
