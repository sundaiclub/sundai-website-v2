import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../../src/app/components/ThemeToggle';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Mock the theme context
const mockUseTheme = jest.fn();
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render theme toggle button', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true, toggleDarkMode: jest.fn() });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show sun icon when in dark mode', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true, toggleDarkMode: jest.fn() });
    
    render(<ThemeToggle />);
    
    // Check for sun icon (dark mode means we show sun to switch to light)
    const sunIcon = screen.getByRole('button').querySelector('svg');
    expect(sunIcon).toBeInTheDocument();
    expect(sunIcon).toHaveClass('text-yellow-300');
  });

  it('should show moon icon when in light mode', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: false, toggleDarkMode: jest.fn() });
    
    render(<ThemeToggle />);
    
    // Check for moon icon (light mode means we show moon to switch to dark)
    const moonIcon = screen.getByRole('button').querySelector('svg');
    expect(moonIcon).toBeInTheDocument();
    expect(moonIcon).toHaveClass('text-gray-700');
  });

  it('should have proper styling classes', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true, toggleDarkMode: jest.fn() });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('rounded-full', 'bg-opacity-20', 'backdrop-blur-sm');
  });

  it('should be clickable', () => {
    const mockToggleDarkMode = jest.fn();
    mockUseTheme.mockReturnValue({ isDarkMode: true, toggleDarkMode: mockToggleDarkMode });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockToggleDarkMode).toHaveBeenCalled();
  });
});