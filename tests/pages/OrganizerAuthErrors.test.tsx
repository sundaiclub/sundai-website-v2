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

jest.mock('../../src/app/components/OrganizerNotePanel', () => {
  return function MockOrganizerNotePanel() {
    return <div>Organizer note panel</div>
  }
})

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

describe('organizer auth error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTheme.mockReturnValue({ isDarkMode: false })
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: null,
    })
  })

  it('shows a signed-out error instead of the organizer event list shell', async () => {
    global.fetch = jest.fn(() => jsonResponse('Unauthorized', 401)) as jest.Mock
    const OrganizerEventsPage =
      require('../../src/app/organizer/events/page').default

    render(<OrganizerEventsPage />)

    expect(await screen.findByText(/please sign in/i)).toBeInTheDocument()
    expect(screen.queryByText(/no organizer events are available/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /new event/i })).not.toBeInTheDocument()
  })

  it('shows permission denied instead of event settings controls', async () => {
    global.fetch = jest.fn(() => jsonResponse('Forbidden', 403)) as jest.Mock
    const EventSettingsPage =
      require('../../src/app/organizer/events/[eventId]/settings/page').default

    render(<EventSettingsPage params={{ eventId: 'event-boston' }} />)

    expect(
      await screen.findByText(/you do not have permission/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/no staff has been assigned/i)).not.toBeInTheDocument()
  })

  it('does not render chapter settings after public chapter fetch when protected details are forbidden', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)

      if (url.includes('/api/chapters/boston')) {
        return jsonResponse({
          id: 'chapter-boston',
          name: 'Sundai Boston',
          slug: 'boston',
          status: 'ACTIVE',
          accessMode: 'PUBLIC',
          defaultDeclineMessage: 'Sensitive organizer-only decline message',
        })
      }

      return jsonResponse('Forbidden', 403)
    }) as jest.Mock
    const ChapterSettingsPage =
      require('../../src/app/organizer/chapters/[chapterSlug]/settings/page').default

    render(<ChapterSettingsPage params={{ chapterSlug: 'boston' }} />)

    expect(
      await screen.findByText(/you do not have permission/i),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByText(/sensitive organizer-only decline message/i),
      ).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /invite admin/i })).not.toBeInTheDocument()
  })
})
