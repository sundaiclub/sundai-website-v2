import React from 'react';
import { render, screen } from '@testing-library/react';

type MockReactMarkdownProps = {
  children?: React.ReactNode;
  className?: string;
  components: {
    a: (props: {
      children: React.ReactNode;
      href?: string;
    }) => React.ReactNode;
  };
  remarkPlugins?: unknown[];
};

const mockReactMarkdown = jest.fn(
  ({ children, components, className }: MockReactMarkdownProps) => (
    <div className={className} data-testid="markdown-renderer">
      {children}
      {components.a({
        children: 'Event guide',
        href: 'https://example.com/guide',
      })}
    </div>
  )
);

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (props: MockReactMarkdownProps) => mockReactMarkdown(props),
}));

import EventMarkdown from '../../src/app/components/EventMarkdown';

describe('EventMarkdown', () => {
  beforeEach(() => {
    mockReactMarkdown.mockClear();
  });

  it('passes event descriptions to the GFM renderer and secures links', () => {
    const markdown =
      'Meet **local builders** and read the [event guide](https://example.com/guide).';

    render(<EventMarkdown className="event-description" markdown={markdown} />);

    expect(screen.getByTestId('markdown-renderer')).toHaveClass(
      'event-description'
    );
    expect(mockReactMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        children: markdown,
        remarkPlugins: expect.any(Array),
      })
    );
    expect(screen.getByRole('link', { name: 'Event guide' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: 'Event guide' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });
});
