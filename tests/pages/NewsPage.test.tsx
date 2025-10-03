import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: jest.fn(),
}))

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

describe('/news page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the Email section with fetched content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        topProjects: [
          {
            id: 'p1',
            title: 'Top 1',
            preview: 'Preview 1',
            createdAt: new Date().toISOString(),
            likeCount: 10,
            thumbnailUrl: null,
            launchLead: { id: 'h1', name: 'Alice', linkedinUrl: null, twitterUrl: null },
            team: [],
            projectUrl: 'https://www.sundai.club/projects/p1',
          },
        ],
      })
    }) as any

    const userCtx = require('../../src/app/contexts/UserContext')
    userCtx.useUserContext.mockReturnValue({ isAdmin: true })
    const themeCtx = require('../../src/app/contexts/ThemeContext')
    themeCtx.useTheme.mockReturnValue({ isDarkMode: false })
    const Comp = require('../../src/app/news/NewsClient').default

    render(<Comp />)

    expect(screen.getByText('Weekly News')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Email HTML')).toBeInTheDocument())
  })

  it('is publicly visible (no admin gate)', async () => {
    const userCtx = require('../../src/app/contexts/UserContext')
    userCtx.useUserContext.mockReturnValue({ isAdmin: false })
    const themeCtx = require('../../src/app/contexts/ThemeContext')
    themeCtx.useTheme.mockReturnValue({ isDarkMode: false })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ topProjects: [] }) }) as any
    const Comp = require('../../src/app/news/NewsClient').default

    render(<Comp />)
    expect(screen.getByText('Weekly News')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  })
})



