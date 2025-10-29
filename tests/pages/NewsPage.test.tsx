// @ts-nocheck
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

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

  it('generates email on demand and shows preview', async () => {
    const weeklyResp = {
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
    }
    ;(global.fetch as any) = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/news/weekly')) return Promise.resolve(weeklyResp)
      if (url.includes('vectorlab.dev/api/tldr')) return Promise.resolve({ ok: true, text: () => Promise.resolve('- A TLDR item') })
      if (url.includes('/api/news/generate')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ htmlBody: '<section id="outline">Modified</section>' }), headers: { get: () => 'application/json' } })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const userCtx = require('../../src/app/contexts/UserContext')
    userCtx.useUserContext.mockReturnValue({ isAdmin: true })
    const themeCtx = require('../../src/app/contexts/ThemeContext')
    themeCtx.useTheme.mockReturnValue({ isDarkMode: false })
    const Comp = require('../../src/app/news/NewsClient').default

    render(<Comp />)
    expect(screen.getByText('Weekly News')).toBeInTheDocument()

    const generateBtn = screen.getByRole('button', { name: 'Generate' })
    fireEvent.click(generateBtn)

    await waitFor(() => expect(screen.getByText('Email HTML')).toBeInTheDocument())
    // Ensures TLDR endpoint was queried
    const calls = (global.fetch as jest.Mock).mock.calls
    expect(calls.some((args: any[]) => String(args[0]).includes('vectorlab.dev/api/tldr'))).toBe(true)
    const previewHeading = screen.getByText('Preview')
    expect(previewHeading).toBeInTheDocument()

    // Validate updated sections exist in generated HTML and removed ones are absent
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const htmlArea = textareas.find(t => t.readOnly) as HTMLTextAreaElement
    expect(htmlArea).toBeTruthy()
    const html = htmlArea.value
    expect(html).toContain('id="tools-club"')
    expect(html).toContain('AI Tools Club, Tuesdays @ 5pm')
    expect(html).toContain('id="community"')
    expect(html).not.toContain('Hacker Combinator')

    // Tools Club button should be black, square (no curve)
    const ctaHref = 'https://partiful.com/e/xZtVjYqjTCVZQ2wlAjCg'
    const ctaIdx = html.indexOf(ctaHref)
    expect(ctaIdx).toBeGreaterThan(-1)
    const ctaSlice = html.slice(ctaIdx - 200, ctaIdx + 200)
    expect(ctaSlice).toContain('background:#111827')
    expect(ctaSlice).toContain('border-radius:0')
    expect(ctaSlice).not.toContain('#f87171')
  })

  it('streams generated content progressively', async () => {
    const weeklyResp = {
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
    }

    const headers = { get: (key: string) => key.toLowerCase() === 'content-type' ? 'text/plain; charset=utf-8' : null } as any

    let step = 0
    const reader = {
      read: jest.fn().mockImplementation(async () => {
        step++
        if (step === 1) return { value: new TextEncoder().encode('Hello '), done: false }
        if (step === 2) return { value: new TextEncoder().encode('World'), done: false }
        return { value: undefined, done: true }
      })
    }
    const streamLike = { getReader: () => reader } as any

    ;(global.fetch as any) = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/news/weekly')) return Promise.resolve(weeklyResp)
      if (url.includes('vectorlab.dev/api/tldr')) return Promise.resolve({ ok: true, text: () => Promise.resolve('- Streamed TLDR item') })
      if (url.includes('/api/news/generate')) return Promise.resolve({ ok: true, headers, body: streamLike })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const userCtx = require('../../src/app/contexts/UserContext')
    userCtx.useUserContext.mockReturnValue({ isAdmin: true })
    const themeCtx = require('../../src/app/contexts/ThemeContext')
    themeCtx.useTheme.mockReturnValue({ isDarkMode: false })
    const Comp = require('../../src/app/news/NewsClient').default

    render(<Comp />)
    const generateBtn = screen.getByRole('button', { name: 'Generate' })
    // Type an instruction to trigger LLM call and streaming
    const instr = screen.getByLabelText('Optional instruction to modify the email')
    fireEvent.change(instr, { target: { value: 'make concise' } })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const generateCall = calls.find((args: any[]) => String(args[0]).includes('/api/news/generate'))
      expect(generateCall).toBeDefined()
      expect(generateCall[1].headers['Accept']).toBe('text/plain')
    })
    // TLDR endpoint should also be fetched
    const calls2 = (global.fetch as jest.Mock).mock.calls
    expect(calls2.some((args: any[]) => String(args[0]).includes('vectorlab.dev/api/tldr'))).toBe(true)
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
  })
})



