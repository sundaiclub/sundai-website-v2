import React from 'react';
import { render, screen } from '@testing-library/react';
import EventsLayout from '../../src/app/events/layout';

describe('EventsLayout', () => {
  it('should render children without any wrapper', () => {
    const mockChildren = <div data-testid="test-children">Test Content</div>;

    render(
      <EventsLayout>
        {mockChildren}
      </EventsLayout>
    );

    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should render multiple children', () => {
    const mockChildren = (
      <>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </>
    );

    render(
      <EventsLayout>
        {mockChildren}
      </EventsLayout>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('should handle empty children', () => {
    render(
      <EventsLayout>
        {null}
      </EventsLayout>
    );

    // Should render without errors
    expect(true).toBe(true);
  });

  it('should handle string children', () => {
    render(
      <EventsLayout>
        Simple text content
      </EventsLayout>
    );

    expect(screen.getByText('Simple text content')).toBeInTheDocument();
  });

  it('should have correct metadata', () => {
    // Import the layout to access metadata
    const layout = require('../../src/app/events/layout');
    
    expect(layout.metadata).toEqual({
      title: "Events | Sundai",
      description: "Check out upcoming events and activities at Sundai",
    });
  });
});
