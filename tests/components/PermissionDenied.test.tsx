import React from 'react';
import { render, screen } from '@testing-library/react';
import PermissionDenied from '../../src/app/components/PermissionDenied';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

describe('PermissionDenied', () => {
  it('should render permission denied message', () => {
    render(
      <ThemeProvider>
        <PermissionDenied />
      </ThemeProvider>
    );
    
    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    render(
      <ThemeProvider>
        <PermissionDenied />
      </ThemeProvider>
    );
    
    const message = screen.getByText('You do not have permission to view this page.');
    expect(message).toHaveClass('text-red-500', 'text-center');
  });

  it('should be a simple component with no props', () => {
    const { container } = render(
      <ThemeProvider>
        <PermissionDenied />
      </ThemeProvider>
    );
    
    // Should render a single div with the message
    expect(container.firstChild).toHaveTextContent('You do not have permission to view this page.');
  });
});
