# Testing Guide

This project includes comprehensive testing setup with Jest, React Testing Library, and automated pre-commit hooks.

## Test Structure

```
tests/
├── components/          # Component tests
├── pages/              # Page tests
├── api/                # API route tests
├── utils/              # Utility function tests
└── utils/
    └── test-utils.tsx  # Test utilities and mocks
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode (for CI/CD)
```bash
npm run test:ci
```

## Test Categories

### 1. Component Tests
- **Location**: `tests/components/`
- **Purpose**: Test React components in isolation
- **Examples**:
  - `Project.test.tsx` - Tests the Project component
  - `TrendingSections.test.tsx` - Tests trending sections
  - `Navbar.test.tsx` - Tests navigation component

### 2. Page Tests
- **Location**: `tests/pages/`
- **Purpose**: Test full page components
- **Examples**:
  - `HomePage.test.tsx` - Tests the home page
  - `ProjectsPage.test.tsx` - Tests the projects listing page

### 3. API Tests
- **Location**: `tests/api/`
- **Purpose**: Test API routes and endpoints
- **Examples**:
  - `projects.test.ts` - Tests project API endpoints
  - `project-like.test.ts` - Tests like/unlike functionality

### 4. Utility Tests
- **Location**: `tests/utils/`
- **Purpose**: Test utility functions
- **Examples**:
  - `nameUtils.test.ts` - Tests name utility functions

## Test Utilities

### Mock Data
The `test-utils.tsx` file provides:
- Mock data factories for projects, hackers, weeks, etc.
- Custom render function with providers
- Mock API responses
- Common test helpers

### Example Usage
```typescript
import { render, screen, mockProject } from '../utils/test-utils'
import MyComponent from '../MyComponent'

test('renders component', () => {
  render(<MyComponent project={mockProject} />)
  expect(screen.getByText('Test Project')).toBeInTheDocument()
})
```

## Pre-commit Hooks

### Setup
```bash
npm run setup-husky
```

### What Runs on Commit
1. **ESLint** - Code linting and fixing
2. **Jest** - Related tests only
3. **Prettier** - Code formatting
4. **Build** - Next.js build verification

### Manual Pre-commit Check
```bash
npm run lint && npm run test:ci && npm run build
```

## GitHub Actions

### Test Workflow
- **File**: `.github/workflows/test.yml`
- **Triggers**: PRs and pushes to main/dev branches
- **Runs**: Linting, type checking, tests, and build
- **Node Versions**: 18.x and 20.x

### Database Test Workflow
- **File**: `.github/workflows/test-with-db.yml`
- **Triggers**: PRs and pushes to main/dev branches
- **Runs**: Full test suite with PostgreSQL database
- **Includes**: Database migrations and seeding

## Coverage Requirements

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Writing Tests

### Component Testing
```typescript
import { render, screen, fireEvent } from '../utils/test-utils'
import MyComponent from '../MyComponent'

test('handles user interaction', () => {
  render(<MyComponent />)
  
  const button = screen.getByRole('button', { name: /click me/i })
  fireEvent.click(button)
  
  expect(screen.getByText('Clicked!')).toBeInTheDocument()
})
```

### API Testing
```typescript
import { GET, POST } from '../../src/app/api/endpoint/route'

test('handles GET request', async () => {
  const request = new NextRequest('http://localhost:3000/api/endpoint')
  const response = await GET(request)
  
  expect(response.status).toBe(200)
})
```

### Mocking External Dependencies
```typescript
// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: mockUser, isSignedIn: true }),
}))

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the component does, not how it does it
   - Test user interactions and outcomes

2. **Use Descriptive Test Names**
   - `should render project title` ✅
   - `test 1` ❌

3. **Arrange, Act, Assert**
   - Set up test data (Arrange)
   - Perform the action (Act)
   - Verify the result (Assert)

4. **Mock External Dependencies**
   - Mock API calls, external libraries, and browser APIs
   - Use the provided mock utilities when possible

5. **Keep Tests Independent**
   - Each test should be able to run in isolation
   - Clean up after each test

6. **Test Edge Cases**
   - Empty states, error states, loading states
   - Invalid inputs and error handling

## Debugging Tests

### Run Specific Test
```bash
npm test -- --testNamePattern="should render project title"
```

### Run Tests in Specific File
```bash
npm test -- tests/components/Project.test.tsx
```

### Debug Mode
```bash
npm test -- --detectOpenHandles --forceExit
```

### Verbose Output
```bash
npm test -- --verbose
```

## Continuous Integration

All tests must pass before:
- Code can be merged to main branch
- Pull requests can be approved
- Deployments can proceed

The CI pipeline includes:
- Linting and formatting checks
- Type checking
- Unit and integration tests
- Build verification
- Security audits
