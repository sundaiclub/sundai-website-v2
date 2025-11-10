// @ts-nocheck
import React from 'react'
import { render, screen, waitFor } from '../utils/test-utils'
import { mockProject } from '../utils/test-utils'

// Mock next/navigation useParams
jest.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'e1' }),
}))

describe('/pitch/[eventId] page', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(global, 'setInterval')
    jest.clearAllMocks()
  })

  it('disables queue interactions when event is finished', async () => {
    const eventResp = {
      id: 'e1',
      title: 'Pitch Night',
      description: 'Event desc',
      startTime: new Date().toISOString(),
      meetingUrl: null,
      audienceCanReorder: true,
      isFinished: true,
      mcs: [],
      projects: [],
    }
    ;(global.fetch as any) = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/events/e1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(eventResp),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const Comp = require('../../src/app/pitch/[eventId]/page').default
    render(<Comp />)

    await waitFor(() => {
      const joinBtn = screen.getByRole('button', { name: /queue locked/i })
      expect(joinBtn).toBeDisabled()
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders current project with full description', async () => {
    const eventResp = {
      id: 'e1',
      title: 'Pitch Night',
      description: 'Event desc',
      startTime: new Date().toISOString(),
      meetingUrl: null,
      audienceCanReorder: false,
      mcs: [],
      projects: [
        {
          id: 'ep1',
          position: 1,
          status: 'CURRENT',
          approved: true,
          project: {
            ...mockProject,
            likes: [],
            participants: [
              {
                role: 'Developer',
                hacker: {
                  id: 'h1',
                  name: 'Alice',
                  avatar: { url: 'https://example.com/a.jpg' },
                },
              },
            ],
          },
        },
      ],
    }
    ;(global.fetch as any) = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/events/e1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(eventResp),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const Comp = require('../../src/app/pitch/[eventId]/page').default
    render(<Comp />)

    await waitFor(() => {
      expect(screen.getByText('Current project')).toBeInTheDocument()
      // Title appears in both the header card and the queue item; allow multiple
      expect(screen.getAllByText(mockProject.title).length).toBeGreaterThan(0)
      // Full description (not just preview) should be visible
      expect(screen.getByText('This is a detailed test project description')).toBeInTheDocument()
      // Team section
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /launch lead/i, level: 4 })).toBeInTheDocument()
      // Participant from mock above
      expect(screen.getByText('Alice')).toBeInTheDocument()
      // Preview image should render with alt text
      expect(screen.getByRole('img', { name: mockProject.title })).toBeInTheDocument()
    })
  })
})


