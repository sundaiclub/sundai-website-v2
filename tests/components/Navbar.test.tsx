import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'
import Navbar from '../../src/app/components/navbar'

// Mock the hooks
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
}))

jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
    },
  }),
  UserButton: () => <div data-testid="user-button">User Button</div>,
  SignInButton: () => <div data-testid="sign-in-button">Sign In Button</div>,
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('Navbar Component', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'test-hacker-id' }),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the navbar', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders the Sundai logo', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    const logo = screen.getByAltText('Sundai Club Logo')
    expect(logo).toBeInTheDocument()
  })

  it('renders navigation links', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    expect(screen.getAllByText('All Projects')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Events')[0]).toBeInTheDocument()
    expect(screen.queryByText('Get Involved')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pitch' })).not.toBeInTheDocument()
  })

  it('renders user button when signed in', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    expect(screen.getAllByTestId('mock-user-button')[0]).toBeInTheDocument()
  })

  it('handles scroll events', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    fireEvent.scroll(window, { target: { scrollY: 100 } })

    const navbar = screen.getByRole('navigation')
    expect(navbar).toHaveClass('shadow-md')
  })

  it('handles menu toggle on mobile', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    const menuButton = screen.getByRole('button')
    fireEvent.click(menuButton)
    
    expect(screen.getAllByText('All Projects')[0]).toBeInTheDocument()
  })

  it('renders in light mode', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    const navbar = screen.getByRole('navigation')
    expect(navbar).toHaveClass('bg-[#E5E5E5]')
  })

  it('fetches hacker ID when user is signed in', async () => {
    await act(async () => {
      render(<Navbar />)
    })
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hackers?clerkId=user_2NfA9d3J3Q3Q3Q3Q3Q3Q3Q3Q3Q3')
    })
  })

  it('links My Profile to /me while the hacker ID is unresolved', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    })

    await act(async () => {
      render(<Navbar />)
    })

    const profileLink = screen.getAllByText('My Profile')[0].closest('a')
    expect(profileLink).toHaveAttribute('href', '/me')
  })

  it('handles fetch error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    
    await act(async () => {
      render(<Navbar />)
    })
    
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
