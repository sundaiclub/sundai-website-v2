import React from 'react';
import { render, screen } from '@testing-library/react';
import EventsPage from '../../src/app/events/page';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

// Mock Next.js components
jest.mock('next/link', () => {
  return function MockLink({ href, children }: any) {
    return <a href={href}>{children}</a>;
  };
});

// Mock the useUserContext hook
jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    userInfo: null,
    isAdmin: false,
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('EventsPage', () => {
  it('should render events page', () => {
    renderWithTheme(<EventsPage />);
    
    expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
  });

  it('should render events content', () => {
    renderWithTheme(<EventsPage />);
    
    // Should show calendar iframe
    expect(screen.getByTitle('Sundai Events Calendar')).toBeInTheDocument();
  });
});
