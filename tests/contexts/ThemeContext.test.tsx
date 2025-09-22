import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/app/contexts/ThemeContext';

// Test component that uses the theme context
const TestComponent = () => {
  const { isDarkMode } = useTheme();
  return <div data-testid="theme-display">{isDarkMode ? 'dark' : 'light'}</div>;
};

describe('ThemeContext', () => {
  it('should provide dark mode theme by default', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
  });

  it('should throw error when useTheme is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });

  it('should provide consistent theme value across re-renders', () => {
    const { rerender } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');

    // Re-render the component
    rerender(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
  });

  it('should work with multiple components using the context', () => {
    const AnotherTestComponent = () => {
      const { isDarkMode } = useTheme();
      return <div data-testid="another-theme-display">{isDarkMode ? 'dark' : 'light'}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
        <AnotherTestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
    expect(screen.getByTestId('another-theme-display')).toHaveTextContent('dark');
  });
});
