import { render, screen, waitFor, fireEvent, act } from '../utils/test-utils'
import Home from '../../src/app/page'
import { mockProject } from '../utils/test-utils'

// Mock the hooks
jest.mock('../../src/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => {},
}))

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
}))

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: {
      id: 'test-user-id',
      name: 'Test User',
    },
  }),
}))

jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
    },
    isLoaded: true,
    isSignedIn: true,
  }),
}))

describe('Home Page', () => {
  beforeEach(() => {
    // Mock fetch for projects API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([mockProject]),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the main heading', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Sundai')).toBeInTheDocument()
    })
  })

  it('renders the tagline', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Building & Launching AI Prototypes Every Sunday.')).toBeInTheDocument()
    })
  })

  it('renders the typewriter effect text', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    // The typewriter effect is mocked, so we just check that the component renders
    // The actual text will be rendered by the mock
    expect(screen.getByText('Building & Launching AI Prototypes Every Sunday.')).toBeInTheDocument()
  })

  it('renders university logos', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      const mitLogo = screen.getByAltText('Logo MIT')
      const harvardLogo = screen.getByAltText('Logo Harvard')
      
      expect(mitLogo).toBeInTheDocument()
      expect(harvardLogo).toBeInTheDocument()
    })
  })

  it('renders social media links', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(screen.getByLabelText('Github')).toBeInTheDocument()
      expect(screen.getByLabelText('Twitter')).toBeInTheDocument()
      expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument()
      expect(screen.getByLabelText('Instagram')).toBeInTheDocument()
    })
  })

  it('renders the foundation link', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      const foundationLink = screen.getByText('More about Sundai')
      expect(foundationLink).toBeInTheDocument()
      expect(foundationLink).toHaveAttribute('href', 'https://sundai.foundation')
    })
  })

  it('renders copyright notice', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('© 2025 Sundai Club. All rights reserved.')).toBeInTheDocument()
    })
  })

  it('fetches and displays projects', async () => {
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/projects?status=APPROVED')
    })
  })

  it('shows loading state initially', async () => {
    // Mock fetch to resolve after a delay to ensure loading state is visible
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: jest.fn().mockResolvedValue([mockProject]),
        }), 100)
      )
    )

    await act(async () => {
      render(<Home />)
    })

    // Should show loading spinner immediately
    const loadingSpinner = document.querySelector('.animate-spin')
    expect(loadingSpinner).toBeInTheDocument()
  })

  it('handles like functionality', async () => {
    const mockLike = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    })
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([mockProject]),
      })
      .mockImplementation(mockLike)

    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      expect(screen.getAllByText('Test Project')[0]).toBeInTheDocument()
    })
    
    const likeButton = screen.getAllByRole('button', { name: /like project test project/i })[0]
    
    await act(async () => {
      fireEvent.click(likeButton)
    })
    
    expect(mockLike).toHaveBeenCalledWith(
      '/api/projects/test-project-id/like',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('handles fetch error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    
    await act(async () => {
      render(<Home />)
    })
    
    await waitFor(() => {
      // Should still render the page even if projects fail to load
      expect(screen.getByText('Sundai')).toBeInTheDocument()
    })
  })
})
