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

// Mock ProjectGrid component
jest.mock('../../src/app/components/Project', () => {
  return function MockProjectGrid({ show_status, statusFilter, showSearch }: any) {
    return (
      <div data-testid="project-grid" data-show-status={show_status} data-status-filter={statusFilter} data-show-search={showSearch}>
        Mock Project Grid
      </div>
    );
  };
});

describe('AdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render admin content when user is admin', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    expect(screen.getByText('Full list of projects in Sundai')).toBeInTheDocument();
    expect(screen.getByTestId('project-grid')).toBeInTheDocument();
    expect(screen.getByTestId('project-grid')).toHaveAttribute('data-show-status', 'true');
    expect(screen.getByTestId('project-grid')).toHaveAttribute('data-status-filter', 'ALL');
    expect(screen.getByTestId('project-grid')).toHaveAttribute('data-show-search', 'true');
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
    expect(screen.queryByTestId('project-grid')).not.toBeInTheDocument();
  });

  it('should apply dark mode styling when isDarkMode is true', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const mainContainer = screen.getByText('Full list of projects in Sundai').closest('div')?.parentElement?.parentElement;
    expect(mainContainer).toHaveClass('bg-gray-900', 'text-gray-100');
  });

  it('should apply light mode styling when isDarkMode is false', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const mainContainer = screen.getByText('Full list of projects in Sundai').closest('div')?.parentElement?.parentElement;
    expect(mainContainer).toHaveClass('bg-white', 'text-gray-900');
  });

  it('should render with proper layout structure', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    // Check for the main container classes
    const mainDiv = screen.getByText('Full list of projects in Sundai').closest('div')?.parentElement;
    expect(mainDiv).toHaveClass('max-w-7xl', 'mx-auto', 'px-2', 'sm:px-4', 'lg:px-8', 'py-20');
  });

  it('should render the heading with proper styling', () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true });
    mockUseUserContext.mockReturnValue({ 
      isAdmin: true, 
      userInfo: { name: 'Admin User' } 
    });

    render(<AdminPage />);

    const heading = screen.getByText('Full list of projects in Sundai');
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
