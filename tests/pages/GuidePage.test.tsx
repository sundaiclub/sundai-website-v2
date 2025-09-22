import React from 'react';
import { render, screen } from '@testing-library/react';
import GuidePage from '../../src/app/guide/page';

describe('GuidePage', () => {
  it('should render the main heading', () => {
    render(<GuidePage />);
    expect(screen.getByText('Guide to Sundai')).toBeInTheDocument();
  });

  it('should render the iframe with correct attributes', () => {
    render(<GuidePage />);
    
    const iframe = screen.getByTitle('Guide to Sundai');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://docs.google.com/presentation/d/1SMAR0z1u4Z30uDnnRmE6Obahn1bRnTaOvZhtrrtwdpg/embed?start=false&loop=false&delayms=3000');
    expect(iframe).toHaveAttribute('allowFullScreen');
    expect(iframe).toHaveClass('absolute', 'top-0', 'left-0', 'w-full', 'h-full');
  });

  it('should render with proper styling classes', () => {
    render(<GuidePage />);
    
    const mainContainer = screen.getByText('Guide to Sundai').closest('div')?.parentElement;
    expect(mainContainer).toHaveClass('min-h-screen', 'bg-gray-900');
  });

  it('should render the iframe container with correct styling', () => {
    render(<GuidePage />);
    
    const iframeContainer = screen.getByTitle('Guide to Sundai').closest('div');
    expect(iframeContainer).toHaveClass('relative', 'w-full', 'bg-gray-800', 'rounded-lg', 'overflow-hidden', 'shadow-xl');
  });

  it('should have correct padding-top style', () => {
    render(<GuidePage />);
    
    const iframeContainer = screen.getByTitle('Guide to Sundai').closest('div');
    expect(iframeContainer).toHaveStyle('padding-top: 56.25%');
  });
});