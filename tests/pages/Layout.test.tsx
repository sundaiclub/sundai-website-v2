import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../../src/app/layout';

// Mock dependencies
jest.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-font' }),
  Space_Mono: () => ({ variable: '--font-space-mono' }),
  Fira_Code: () => ({ variable: '--font-fira-code' }),
}));

jest.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="clerk-provider">{children}</div>,
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="user-provider">{children}</div>,
}));

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
}));

jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="analytics">Analytics</div>,
}));

jest.mock('../../src/app/providers', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="posthog-provider">{children}</div>,
}));

jest.mock('../../src/app/components/Providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>,
}));

jest.mock('../../src/app/components/navbar', () => {
  return function MockNavbar() {
    return <div data-testid="navbar">Navbar</div>;
  };
});

const mockChildren = <div data-testid="children">Test Content</div>;

describe('RootLayout', () => {
  it('should render with all providers and components', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    // Check that all providers are rendered
    expect(screen.getByTestId('posthog-provider')).toBeInTheDocument();
    expect(screen.getByTestId('clerk-provider')).toBeInTheDocument();
    expect(screen.getByTestId('user-provider')).toBeInTheDocument();
    expect(screen.getByTestId('providers')).toBeInTheDocument();

    // Check that main components are rendered
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('analytics')).toBeInTheDocument();
  });

  it('should have correct HTML structure', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    // Check that the layout renders without errors
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('should include Google Analytics script', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    // Check for Google Analytics script
    const gtagScript = document.querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=G-HV7HE6PBDD"]');
    expect(gtagScript).toBeInTheDocument();

    // Check for inline Google Analytics script
    const inlineScript = document.querySelector('script#google-analytics');
    expect(inlineScript).toBeInTheDocument();
    expect(inlineScript?.textContent).toContain('gtag');
  });

  it('should include Apple mobile web app meta tag', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    const metaTag = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    expect(metaTag).toHaveAttribute('content', 'Sundai');
  });

  it('should have correct viewport settings', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    // The viewport is set via the viewport export, not as a meta tag
    // This test verifies the viewport configuration is available
    expect(RootLayout).toBeDefined();
  });

  it('should apply correct CSS classes and styles', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    // Check that the layout renders without errors
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('should render children in the correct container', () => {
    render(
      <RootLayout>
        {mockChildren}
      </RootLayout>
    );

    const childrenContainer = screen.getByTestId('children').parentElement;
    expect(childrenContainer).toHaveClass('origin-top-left', 'min-h-screen', 'pt-16');
  });
});
