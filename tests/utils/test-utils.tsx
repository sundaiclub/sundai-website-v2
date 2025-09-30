import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Mock ClerkProvider
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: 'user_2NfA9d3J3Q3Q3Q3Q3Q3Q3Q3Q3Q3',
      fullName: 'John Doe',
      emailAddresses: [{ emailAddress: 'john.doe@example.com' }],
    },
  }),
  useAuth: () => ({
    userId: 'user_2NfA9d3J3Q3Q3Q3Q3Q3Q3Q3Q3Q3',
    sessionId: 'sess_2NfA9d3J3Q3Q3Q3Q3Q3Q3Q3Q3Q3',
    getToken: jest.fn(() => Promise.resolve('mock-token')),
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-clerk-provider">{children}</div>
  ),
  SignInButton: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="mock-signin-button">{children}</button>
  ),
  UserButton: () => <div data-testid="mock-user-button"></div>,
}))

// Mock ThemeContext
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    toggleTheme: jest.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-theme-provider">{children}</div>
  ),
}))

// Mock UserContext
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: {
      id: 'hacker_123',
      name: 'John Doe',
      clerkId: 'user_2NfA9d3J3Q3Q3Q3Q3Q3Q3Q3Q3',
    },
    setUserInfo: jest.fn(),
    loading: false,
  }),
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-user-context-provider">{children}</div>
  ),
}))

// Simple wrapper without context providers for now
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock data factories
export const mockProject = {
  id: 'test-project-id',
  title: 'Test Project',
  preview: 'A test project description',
  description: 'This is a detailed test project description',
  githubUrl: 'https://github.com/test/project',
  demoUrl: 'https://demo.example.com',
  blogUrl: 'https://blog.example.com',
  status: 'APPROVED' as const,
  is_starred: false,
  is_broken: false,
  thumbnail: {
    url: 'https://example.com/thumbnail.jpg',
  },
  launchLead: {
    id: 'test-hacker-id',
    name: 'Test Hacker',
    twitterUrl: 'https://twitter.com/testhacker',
    linkedinUrl: 'https://linkedin.com/in/testhacker',
    avatar: {
      url: 'https://example.com/avatar.jpg',
    },
  },
  participants: [
    {
      role: 'Developer',
      hacker: {
        id: 'test-hacker-id',
        name: 'Test Hacker',
        avatar: {
          url: 'https://example.com/avatar.jpg',
        },
      },
    },
  ],
  techTags: [
    {
      id: 'tech-1',
      name: 'React',
      description: 'A JavaScript library for building user interfaces',
    },
  ],
  domainTags: [
    {
      id: 'domain-1',
      name: 'AI/ML',
      description: 'Artificial Intelligence and Machine Learning',
    },
  ],
  likes: [],
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

export const mockHacker = {
  id: 'test-hacker-id',
  clerkId: 'test-clerk-id',
  name: 'Test Hacker',
  username: 'testhacker',
  role: 'HACKER' as const,
  bio: 'A test hacker bio',
  githubUrl: 'https://github.com/testhacker',
  discordName: 'testhacker#1234',
  twitterUrl: 'https://twitter.com/testhacker',
  linkedinUrl: 'https://linkedin.com/in/testhacker',
  websiteUrl: 'https://testhacker.com',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  attended: 5,
  avatar: {
    url: 'https://example.com/avatar.jpg',
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

export const mockWeek = {
  id: 'test-week-id',
  number: 1,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
  theme: 'AI Innovation',
  description: 'A week focused on AI innovation',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

export const mockTechTag = {
  id: 'tech-1',
  name: 'React',
  description: 'A JavaScript library for building user interfaces',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

export const mockDomainTag = {
  id: 'domain-1',
  name: 'AI/ML',
  description: 'Artificial Intelligence and Machine Learning',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
}

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
})

// Mock fetch for API calls
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue(mockApiResponse(response, status))
}

// Mock fetch error
export const mockFetchError = (message = 'Network error') => {
  global.fetch = jest.fn().mockRejectedValue(new Error(message))
}

// Reset all mocks
export const resetMocks = () => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
