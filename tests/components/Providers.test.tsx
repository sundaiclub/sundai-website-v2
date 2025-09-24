import React from 'react';
import { render, screen } from '@testing-library/react';
import { Providers } from '../../src/app/components/Providers';

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  Toaster: ({ position }: { position: string }) => (
    <div data-testid="toaster" data-position={position}>Toaster</div>
  ),
}));

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  it('should render with all providers and children', () => {
    const mockChildren = <div data-testid="test-children">Test Content</div>;

    render(
      <Providers>
        {mockChildren}
      </Providers>
    );

    // Check that all providers are rendered
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should render Toaster with correct position', () => {
    const mockChildren = <div>Test Content</div>;

    render(
      <Providers>
        {mockChildren}
      </Providers>
    );

    const toaster = screen.getByTestId('toaster');
    expect(toaster).toHaveAttribute('data-position', 'bottom-right');
  });

  it('should render children inside ThemeProvider', () => {
    const mockChildren = <div data-testid="nested-content">Nested Content</div>;

    render(
      <Providers>
        {mockChildren}
      </Providers>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    const nestedContent = screen.getByTestId('nested-content');
    
    expect(themeProvider).toContainElement(nestedContent);
  });

  it('should handle multiple children', () => {
    const mockChildren = (
      <>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </>
    );

    render(
      <Providers>
        {mockChildren}
      </Providers>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should handle empty children', () => {
    render(
      <Providers>
        {null}
      </Providers>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });
});
