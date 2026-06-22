import React from 'react'
import { render, screen } from '@testing-library/react'

import EventsPage from '../../src/app/events/page'

const mockUseTheme = jest.fn()

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}))

jest.mock('../../src/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: jest.fn(),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

describe('/events public page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTheme.mockReturnValue({ isDarkMode: false })
    global.fetch = jest.fn() as jest.Mock

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })
  })

  it('exposes the public Google calendar without native event-management flows', () => {
    render(<EventsPage />)

    expect(
      screen.getByRole('heading', { name: /upcoming events/i }),
    ).toBeInTheDocument()
    expect(screen.getByTitle(/sundai events calendar/i)).toHaveAttribute(
      'src',
      expect.stringContaining('calendar.google.com/calendar/embed'),
    )
    expect(
      screen.getByRole('link', { name: /add to google calendar/i }),
    ).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))

    const nativeFlowLabels = [
      /rsvp/i,
      /apply/i,
      /application/i,
      /approved/i,
      /approval/i,
      /status/i,
      /check[- ]?in/i,
      /qr/i,
      /registration/i,
      /ticket/i,
    ]

    nativeFlowLabels.forEach((label) => {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: label })).not.toBeInTheDocument()
    })

    nativeFlowLabels.forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    })

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/.*(rsvp|application|registration|check[-]?in)/i),
      expect.anything(),
    )
  })
})
