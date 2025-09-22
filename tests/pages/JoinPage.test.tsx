import React from 'react';
import { render, screen } from '@testing-library/react';
import JoinPage from '../../src/app/join/page';
import { useTheme } from '../../src/app/contexts/ThemeContext';

// Mock the theme context
jest.mock('../../src/app/contexts/ThemeContext');

// Mock Next.js components
jest.mock('next/script', () => {
  return function MockScript({ src, onLoad }: any) {
    return <script src={src} onLoad={onLoad} />;
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock Tally
const mockTally = {
  loadEmbeds: jest.fn(),
};

Object.defineProperty(window, 'Tally', {
  value: mockTally,
  writable: true,
});

const mockUseTheme = useTheme as jest.Mock;

describe('JoinPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render join page in light mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    expect(screen.getByText('Join Sundai Club')).toBeInTheDocument();
    expect(screen.getByTitle('Newsletter subscribers')).toBeInTheDocument();
  });

  it('should render join page in dark mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: true,
    });

    render(<JoinPage />);

    expect(screen.getByText('Join Sundai Club')).toBeInTheDocument();
    expect(screen.getByTitle('Newsletter subscribers')).toBeInTheDocument();
  });

  it('should have correct iframe attributes in light mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    const iframe = screen.getByTitle('Newsletter subscribers');
    expect(iframe).toHaveAttribute('data-tally-src', 'https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1');
    expect(iframe).toHaveAttribute('width', '100%');
    expect(iframe).toHaveAttribute('height', '216');
    expect(iframe).toHaveAttribute('frameBorder', '0');
  });

  it('should have correct iframe attributes in dark mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: true,
    });

    render(<JoinPage />);

    const iframe = screen.getByTitle('Newsletter subscribers');
    expect(iframe).toHaveAttribute('data-tally-src', 'https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1&theme=dark');
  });

  it('should load Tally embeds on mount when Tally is available', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    expect(mockTally.loadEmbeds).toHaveBeenCalled();
  });

  it('should not call Tally.loadEmbeds when Tally is not available', () => {
    // Remove Tally from window
    delete (window as any).Tally;

    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    // Should not throw error and should render normally
    expect(screen.getByText('Join Sundai Club')).toBeInTheDocument();
  });

  it('should have correct CSS classes for light mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    const container = screen.getByText('Join Sundai Club').closest('div')?.parentElement?.parentElement?.parentElement;
    expect(container).toHaveClass('bg-gradient-to-b', 'from-[#E5E5E5]', 'to-[#F0F0F0]', 'text-gray-800');
  });

  it('should have correct CSS classes for dark mode', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: true,
    });

    render(<JoinPage />);

    const container = screen.getByText('Join Sundai Club').closest('div')?.parentElement?.parentElement?.parentElement;
    expect(container).toHaveClass('bg-gradient-to-b', 'from-gray-900', 'to-black', 'text-gray-100');
  });

  it('should render the Tally script', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
    });

    render(<JoinPage />);

    const script = document.querySelector('script[src="https://tally.so/widgets/embed.js"]');
    expect(script).toBeInTheDocument();
  });
});
