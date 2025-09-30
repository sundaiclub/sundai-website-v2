import React from 'react';
import { render, screen } from '@testing-library/react';
import WeeksPage from '../../src/app/weeks/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

// Mock Next.js components
jest.mock('next/link', () => {
  return function MockLink({ href, children }: any) {
    return <a href={href}>{children}</a>;
  };
});

// Mock the useUserContext hook
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: null,
    isAdmin: false,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('WeeksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render weeks page', () => {
    renderWithTheme(<WeeksPage />);
    
    // Should show loading spinner initially
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render loading state initially', () => {
    renderWithTheme(<WeeksPage />);
    
    // Should show loading spinner
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
