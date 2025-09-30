import React from 'react';
import { render, screen } from '@testing-library/react';
import GifDisplay from '../../src/app/components/GifDisplay';

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function Image({ src, alt, width, height, className, quality }: any) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        data-quality={quality}
      />
    );
  };
});

// Mock the GIF imports
jest.mock('../../../public/assets/pip-ai_workflow.gif', () => 'mocked-gif-1.gif');
jest.mock('../../../public/assets/standard_workflow.gif', () => 'mocked-gif-2.gif');

describe('GifDisplay', () => {
  it('should render with default props', () => {
    render(<GifDisplay />);
    
    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'GIF');
    expect(image).toHaveClass('rounded-lg', 'shadow-lg');
  });

  it('should render with custom props', () => {
    render(<GifDisplay altText="Custom GIF" width={600} height={400} />);
    
    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'Custom GIF');
    expect(image).toHaveAttribute('width', '600');
    expect(image).toHaveAttribute('height', '400');
  });

  it('should render toggle button', () => {
    render(<GifDisplay />);
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveClass('w-16', 'h-6', 'rounded-full', 'p-1', 'cursor-pointer');
  });

  it('should have proper styling classes', () => {
    render(<GifDisplay />);
    
    const image = screen.getByRole('img');
    expect(image).toHaveClass('rounded-lg', 'shadow-lg');
  });

  it('should render container with proper classes', () => {
    render(<GifDisplay />);
    
    const container = screen.getByRole('img').closest('div');
    expect(container).toHaveClass('flex', 'flex-col', 'justify-center', 'items-center', 'mb-[-3rem]');
  });
});