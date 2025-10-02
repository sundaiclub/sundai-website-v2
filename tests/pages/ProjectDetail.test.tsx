import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ProjectDetail from '../../src/app/projects/[projectId]/page'
import { ThemeProvider } from '../../src/app/contexts/ThemeContext'

// Mock UserContext
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: null,
    loading: false,
  }),
}))

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
  useParams: () => ({
    projectId: 'test-project-id',
  }),
}))

// Silence toast imports used in page
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('ProjectDetail Page - Like Count', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('displays like count from API response', async () => {
    const mockProject = {
      id: 'test-project-id',
      title: 'Test Project',
      preview: 'Preview text',
      description: 'Long description',
      status: 'APPROVED',
      is_starred: false,
      is_broken: false,
      thumbnail: { url: 'https://example.com/thumbnail.jpg' },
      launchLead: { id: 'lead-1', name: 'Lead User', avatar: null },
      participants: [],
      techTags: [],
      domainTags: [],
      startDate: new Date('2024-01-01').toISOString(),
      likes: [
        { hackerId: 'a', createdAt: new Date().toISOString() },
        { hackerId: 'b', createdAt: new Date().toISOString() },
        { hackerId: 'c', createdAt: new Date().toISOString() },
      ],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProject),
    })

    render(
      <ThemeProvider>
        <ProjectDetail />
      </ThemeProvider>
    )

    await waitFor(() => {
      // The like button shows the count as text
      expect(screen.getByLabelText('Likes 3')).toBeInTheDocument()
    })
  })
})


