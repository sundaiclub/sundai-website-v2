import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminPage from '../../src/app/admin/page';

// Mock the context providers
const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

describe('AdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the site-admin console when user is admin', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    expect(screen.getByRole('heading', { name: 'Site admin console' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Project moderation' })).toHaveAttribute('href', '/admin/projects');
    expect(screen.getByRole('link', { name: 'Chapters' })).toHaveAttribute('href', '/admin/chapters');
    expect(screen.getByRole('link', { name: 'Application templates' })).toHaveAttribute('href', '/admin/application-templates');
    expect(screen.getByRole('link', { name: 'Global moderation' })).toHaveAttribute('href', '/admin/bans');
    expect(screen.getByRole('link', { name: 'Organizer events' })).toHaveAttribute('href', '/organizer/events');
  });

  it('should render permission denied message when user is not admin', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: false, 
      userInfo: { name: 'Regular User' } 
    });

    render(<AdminPage />);

    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to view this page.')).toHaveClass('text-red-500');
    expect(screen.queryByRole('heading', { name: 'Site admin console' })).not.toBeInTheDocument();
  });

  it('should apply dark mode styling when isDarkMode is true', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const mainContainer = screen.getByRole('main');
    expect(mainContainer).toHaveClass('bg-gray-900', 'text-gray-100');
  });

  it('should apply light mode styling when isDarkMode is false', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const mainContainer = screen.getByRole('main');
    expect(mainContainer).toHaveClass('bg-white', 'text-gray-900');
  });

  it('should render with proper layout structure', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const mainDiv = screen.getByRole('heading', { name: 'Site admin console' }).parentElement;
    expect(mainDiv).toHaveClass('max-w-6xl', 'mx-auto', 'px-4', 'py-20');
  });

  it('should render the heading with proper styling', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const heading = screen.getByRole('heading', { name: 'Site admin console' });
    expect(heading).toHaveClass('text-3xl', 'font-bold');
  });

  it('should handle undefined userInfo gracefully', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: false, 
      userInfo: null 
    });

    render(<AdminPage />);

    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
  });

  it('should handle undefined isAdmin gracefully', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: undefined, 
      userInfo: { name: 'User' } 
    });

    render(<AdminPage />);

    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument();
  });
});
