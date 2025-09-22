import '@testing-library/jest-dom'
import React from 'react'

// Suppress console.error during tests for cleaner output
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn() // Mock console.error to suppress all error logs during tests
})

afterAll(() => {
  console.error = originalError
})

// Polyfill for Web APIs
global.Request = global.Request || class Request {
  constructor(input, init = {}) {
    this._url = input
    this.method = init.method || 'GET'
    this.headers = new Headers(init.headers)
    this.body = init.body
  }
  
  get url() {
    return this._url
  }
  
  async formData() {
    return new FormData()
  }
}

// Mock FormData
global.FormData = global.FormData || class FormData {
  constructor() {
    this.entries = []
  }

  append(name, value) {
    this.entries.push([name, value])
  }

  get(name) {
    const entry = this.entries.find(([key]) => key === name)
    return entry ? entry[1] : null
  }

  has(name) {
    return this.entries.some(([key]) => key === name)
  }

  delete(name) {
    this.entries = this.entries.filter(([key]) => key !== name)
  }

  forEach(callback) {
    this.entries.forEach(callback)
  }
}

global.Response = global.Response || class Response {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Headers(init.headers)
  }
  
  async json() {
    try {
      return JSON.parse(this.body)
    } catch (e) {
      return this.body
    }
  }
  
  async text() {
    return this.body
  }
}

// Mock NextResponse
global.NextResponse = global.NextResponse || class NextResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Headers(init.headers)
  }

  static json(data, init = {}) {
    return new NextResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  }

  async json() {
    try {
      return JSON.parse(this.body)
    } catch (e) {
      return this.body
    }
  }

  async text() {
    return this.body
  }
}

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: global.NextResponse,
  NextRequest: class NextRequest extends global.Request {
    constructor(input, init = {}) {
      super(input, init)
      this._formData = null
    }

    async formData() {
      if (!this._formData) {
        this._formData = new FormData()
        // Parse the body if it's a string
        if (this.body && typeof this.body === 'string') {
          // This is a simplified parser - in real tests, you'd need proper multipart parsing
          const lines = this.body.split('\n')
          for (const line of lines) {
            if (line.includes('name=')) {
              const match = line.match(/name="([^"]+)"[^]*?([^\r\n]+)/)
              if (match) {
                this._formData.append(match[1], match[2].trim())
              }
            }
          }
        }
      }
      return this._formData
    }
  },
}))

global.Headers = global.Headers || class Headers {
  constructor(init = {}) {
    this.map = new Map()
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.map.set(key.toLowerCase(), value)
      })
    }
  }
  
  get(name) {
    return this.map.get(name.toLowerCase())
  }
  
  set(name, value) {
    this.map.set(name.toLowerCase(), value)
  }
  
  has(name) {
    return this.map.has(name.toLowerCase())
  }
  
  delete(name) {
    this.map.delete(name.toLowerCase())
  }
}

global.URL = global.URL || class URL {
  constructor(input, base) {
    this.href = input
    this.searchParams = new URLSearchParams()
  }
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({
    userId: 'test-user-id',
    isLoaded: true,
    isSignedIn: true,
  }),
  ClerkProvider: ({ children }) => children,
  SignIn: () => <div>Sign In</div>,
  SignUp: () => <div>Sign Up</div>,
  UserButton: () => <div>User Button</div>,
}))

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      // Filter out framer-motion specific props to avoid warnings
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <div {...restProps}>{children}</div>
    },
    span: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <span {...restProps}>{children}</span>
    },
    button: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <button {...restProps}>{children}</button>
    },
    img: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <img {...restProps}>{children}</img>
    },
    section: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <section {...restProps}>{children}</section>
    },
    footer: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <footer {...restProps}>{children}</footer>
    },
    h1: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <h1 {...restProps}>{children}</h1>
    },
    h2: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <h2 {...restProps}>{children}</h2>
    },
    h3: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <h3 {...restProps}>{children}</h3>
    },
    p: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <p {...restProps}>{children}</p>
    },
    ul: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <ul {...restProps}>{children}</ul>
    },
    li: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <li {...restProps}>{children}</li>
    },
    a: ({ children, ...props }) => {
      const { whileHover, whileTap, initial, animate, exit, ...restProps } = props
      return <a {...restProps}>{children}</a>
    },
  },
  AnimatePresence: ({ children }) => children,
}))

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}))

// Mock typewriter-effect
jest.mock('typewriter-effect', () => {
  return function Typewriter({ onInit, children, ...props }) {
    React.useEffect(() => {
      if (onInit) {
        const mockTypewriter = {
          changeDelay: jest.fn().mockReturnThis(),
          typeString: jest.fn().mockReturnThis(),
          callFunction: jest.fn().mockReturnThis(),
          start: jest.fn(),
        }
        onInit(mockTypewriter)
      }
    }, [onInit])
    return <div {...props}>{children}</div>
  }
})

// Mock react-intersection-observer
jest.mock('react-intersection-observer', () => ({
  useInView: () => [jest.fn(), true],
}))

// Mock PostHog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
}))

// Mock Vercel Analytics
jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}))

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue([{}]),
        getSignedUrl: jest.fn().mockResolvedValue(['https://example.com/image.jpg']),
      }),
    }),
  })),
}))

// Mock Replicate
jest.mock('replicate', () => ({
  Replicate: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(['https://example.com/generated-image.jpg']),
  })),
}))

// Mock Nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}))

// Mock Svix
jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockReturnValue({ type: 'user.created', data: {} }),
  })),
}))


// Global fetch mock
global.fetch = jest.fn()

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.sessionStorage = sessionStorageMock
