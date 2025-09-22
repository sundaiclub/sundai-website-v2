import React from 'react';
import { render, screen } from '@testing-library/react';
import AboutPage from '../../src/app/about';

// Mock Next.js components
jest.mock('next/head', () => {
  return function Head({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
});

jest.mock('next/link', () => {
  return function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock GifDisplay component
jest.mock('../../src/app/components/GifDisplay', () => {
  return function MockGifDisplay({ altText, width, height }: any) {
    return <div data-testid="gif-display" data-alt={altText} data-width={width} data-height={height} />;
  };
});

describe('AboutPage', () => {
  it('should render the main heading', () => {
    render(<AboutPage />);
    expect(screen.getByText('Track Your Medication Side Effects with AI')).toBeInTheDocument();
  });

  it('should render the hero section description', () => {
    render(<AboutPage />);
    expect(screen.getByText(/We help you track and report your experiences with medications/)).toBeInTheDocument();
  });

  it('should render the submit experience button', () => {
    render(<AboutPage />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Your Experience')).toBeInTheDocument();
  });

  it('should render the join community link', () => {
    render(<AboutPage />);
    const joinLink = screen.getByText('Join Our Community');
    expect(joinLink).toBeInTheDocument();
    expect(joinLink.closest('a')).toHaveAttribute('href', '/waitlist');
  });

  it('should render the AI-driven insights section', () => {
    render(<AboutPage />);
    expect(screen.getByText('AI-Driven Insights')).toBeInTheDocument();
    expect(screen.getByText(/Our AI scrapes forums and communities/)).toBeInTheDocument();
  });

  it('should render the GifDisplay component with correct props', () => {
    render(<AboutPage />);
    const gifDisplay = screen.getByTestId('gif-display');
    expect(gifDisplay).toBeInTheDocument();
    expect(gifDisplay).toHaveAttribute('data-alt', 'Side Effect Discovery');
    expect(gifDisplay).toHaveAttribute('data-width', '400');
    expect(gifDisplay).toHaveAttribute('data-height', '300');
  });

  it('should render the mission section', () => {
    render(<AboutPage />);
    expect(screen.getByText('Our Mission')).toBeInTheDocument();
    expect(screen.getByText(/We're dedicated to empowering patients/)).toBeInTheDocument();
  });

  it('should render the support section', () => {
    render(<AboutPage />);
    expect(screen.getByText('Support Our Cause')).toBeInTheDocument();
    expect(screen.getByText(/Your support helps us continue developing/)).toBeInTheDocument();
  });

  it('should render all support links', () => {
    render(<AboutPage />);
    
    const donateLink = screen.getByText('Donate');
    const talkLink = screen.getByText('Talk to Us');
    const waitlistLink = screen.getByText('Join the Waitlist');
    
    expect(donateLink).toBeInTheDocument();
    expect(talkLink).toBeInTheDocument();
    expect(waitlistLink).toBeInTheDocument();
    
    // Check that they are external links
    expect(donateLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(talkLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(waitlistLink.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('should render the footer', () => {
    render(<AboutPage />);
    expect(screen.getByText('© 2024 Drug Side Effects Tracker. All rights reserved.')).toBeInTheDocument();
  });

  it('should have proper meta tags in head', () => {
    render(<AboutPage />);
    
    // Check if the title is rendered (though it might not be visible in the DOM)
    const titleElement = document.querySelector('title');
    expect(titleElement).toBeInTheDocument();
  });

  it('should render all sections with proper styling classes', () => {
    render(<AboutPage />);
    
    // Check for main container classes
    const mainContainer = screen.getByText('Track Your Medication Side Effects with AI').closest('div')?.parentElement?.parentElement;
    expect(mainContainer).toHaveClass('bg-gray-900', 'text-gray-100');
  });

  it('should render the code-style submit button', () => {
    render(<AboutPage />);
    const submitButton = screen.getByText('Submit').closest('div');
    expect(submitButton).toHaveClass('bg-gray-900', 'text-green-400', 'font-mono');
  });
});
