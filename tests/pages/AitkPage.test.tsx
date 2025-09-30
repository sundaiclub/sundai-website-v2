import React from 'react';
import { render, screen } from '@testing-library/react';
import AitkPage from '../../src/app/aitk/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

// Mock Next.js components
jest.mock('next/link', () => {
  return function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock Next.js Script component
jest.mock('next/script', () => {
  return function Script({ src, onLoad }: { src: string; onLoad: () => void }) {
    React.useEffect(() => {
      if (onLoad) onLoad();
    }, [onLoad]);
    return null;
  };
});

// Mock Tally global
global.Tally = {
  loadEmbeds: jest.fn(),
};

describe('AitkPage', () => {
  it('should render the main heading', () => {
    render(
      <ThemeProvider>
        <AitkPage />
      </ThemeProvider>
    );
    expect(screen.getByText('AI Tools Klub (AITK)')).toBeInTheDocument();
  });

  it('should render the iframe with correct attributes', () => {
    render(
      <ThemeProvider>
        <AitkPage />
      </ThemeProvider>
    );
    
    const iframe = screen.getByTitle('Newsletter subscribers');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('data-tally-src', 'https://tally.so/embed/nr0bpp?hideTitle=1&dynamicHeight=1');
    expect(iframe).toHaveAttribute('width', '100%');
    expect(iframe).toHaveAttribute('height', '216');
    expect(iframe).toHaveAttribute('frameBorder', '0');
  });

  it('should render with proper styling classes', () => {
    render(
      <ThemeProvider>
        <AitkPage />
      </ThemeProvider>
    );
    
    const mainContainer = screen.getByText('AI Tools Klub (AITK)').closest('div')?.parentElement?.parentElement;
    expect(mainContainer).toHaveClass('relative', 'py-16', 'md:py-24', 'lg:py-26', 'px-4', 'md:px-8');
  });

  it('should render the iframe container with correct styling', () => {
    render(
      <ThemeProvider>
        <AitkPage />
      </ThemeProvider>
    );
    
    const iframeContainer = screen.getByTitle('Newsletter subscribers').closest('div');
    expect(iframeContainer).toHaveClass('rounded-lg', 'p-6', 'shadow-lg');
  });

  it('should have proper motion animation props', () => {
    render(
      <ThemeProvider>
        <AitkPage />
      </ThemeProvider>
    );
    
    const motionDiv = screen.getByText('AI Tools Klub (AITK)').closest('div');
    expect(motionDiv).toHaveClass('max-w-3xl', 'mx-auto');
  });
});