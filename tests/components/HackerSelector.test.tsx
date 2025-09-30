import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HackerSelector, ProjectRoles, Hacker, TeamMember } from '../../src/app/components/HackerSelector';

// Mock the theme context
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

const mockHackers: Hacker[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
];

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
  isDarkMode: false,
  searchTerm: '',
  setSearchTerm: jest.fn(),
  filteredHackers: mockHackers,
  title: 'Select Hackers',
  singleSelect: false,
  selectedIds: [],
  showRoleSelector: false,
  handleAddMember: jest.fn(),
  onAddMemberWithRole: jest.fn(),
};

describe('HackerSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal when showModal is true', () => {
    render(<HackerSelector {...defaultProps} />);
    
    expect(screen.getByText('Select Hackers')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument();
  });

  it('should not render modal when showModal is false', () => {
    render(<HackerSelector {...defaultProps} showModal={false} />);
    
    expect(screen.queryByText('Select Hackers')).not.toBeInTheDocument();
  });

  it('should display filtered hackers', () => {
    render(<HackerSelector {...defaultProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('should call setSearchTerm when typing in search input', () => {
    const setSearchTerm = jest.fn();
    render(<HackerSelector {...defaultProps} setSearchTerm={setSearchTerm} />);
    
    const searchInput = screen.getByPlaceholderText('Search members...');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    expect(setSearchTerm).toHaveBeenCalledWith('John');
  });

  it('should call setShowModal when close button is clicked', () => {
    const setShowModal = jest.fn();
    render(<HackerSelector {...defaultProps} setShowModal={setShowModal} />);
    
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('should call handleAddMember when hacker is clicked in single select mode', () => {
    const handleAddMember = jest.fn();
    render(
      <HackerSelector 
        {...defaultProps} 
        singleSelect={true}
        handleAddMember={handleAddMember}
      />
    );
    
    const hackerButton = screen.getByText('John Doe');
    fireEvent.click(hackerButton);
    
    expect(handleAddMember).toHaveBeenCalledWith(mockHackers[0]);
  });

  it('should show role selector when showRoleSelector is true', () => {
    render(<HackerSelector {...defaultProps} showRoleSelector={true} />);
    
    expect(screen.getByText('Role')).toBeInTheDocument();
    ProjectRoles.forEach(role => {
      expect(screen.getByText(role.label)).toBeInTheDocument();
    });
  });

  it('should call onAddMemberWithRole when role is selected and hacker is clicked', async () => {
    const onAddMemberWithRole = jest.fn();
    render(
      <HackerSelector 
        {...defaultProps} 
        showRoleSelector={true}
        onAddMemberWithRole={onAddMemberWithRole}
      />
    );
    
    // Select a role
    const roleButton = screen.getByText('Builder');
    fireEvent.click(roleButton);
    
    // Click on a hacker
    const hackerButton = screen.getByText('John Doe');
    fireEvent.click(hackerButton);
    
    await waitFor(() => {
      expect(onAddMemberWithRole).toHaveBeenCalledWith(mockHackers[0], 'hacker');
    });
  });

  it('should show selected hackers with checkmarks', () => {
    render(<HackerSelector {...defaultProps} selectedIds={['1', '2']} />);
    
    // Check if selected hackers show checkmarks
    const johnDoeButton = screen.getByText('John Doe').closest('button');
    const janeSmithButton = screen.getByText('Jane Smith').closest('button');
    
    expect(johnDoeButton).toHaveClass('bg-indigo-50');
    expect(janeSmithButton).toHaveClass('bg-indigo-50');
  });

  it('should show "No hackers found" when filteredHackers is empty', () => {
    render(<HackerSelector {...defaultProps} filteredHackers={[]} />);
    
    expect(screen.getByText('No members found')).toBeInTheDocument();
  });

  it('should handle custom title', () => {
    render(<HackerSelector {...defaultProps} title="Custom Title" />);
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('should show email addresses for hackers', () => {
    render(<HackerSelector {...defaultProps} />);
    
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('should handle role selection state correctly', async () => {
    render(<HackerSelector {...defaultProps} showRoleSelector={true} />);
    
    // Initially no role should be selected
    const builderButton = screen.getByText('Builder');
    expect(builderButton).not.toHaveClass('bg-blue-500');
    
    // Click on a role
    fireEvent.click(builderButton);
    
    // Role should now be selected
    await waitFor(() => {
      expect(builderButton).toHaveClass('bg-indigo-600');
    });
  });

  it('should reset role selection when modal is closed and reopened', () => {
    const { rerender } = render(
      <HackerSelector {...defaultProps} showRoleSelector={true} />
    );
    
    // Select a role
    const builderButton = screen.getByText('Builder');
    fireEvent.click(builderButton);
    
    // Close modal
    rerender(<HackerSelector {...defaultProps} showRoleSelector={true} showModal={false} />);
    
    // Reopen modal
    rerender(<HackerSelector {...defaultProps} showRoleSelector={true} showModal={true} />);
    
    // Role should be reset
    expect(builderButton).not.toHaveClass('bg-blue-500');
  });
});

describe('ProjectRoles', () => {
  it('should contain all expected roles', () => {
    const expectedRoles = [
      { id: 'hacker', label: 'Builder' },
      { id: 'developer', label: 'Developer' },
      { id: 'caio', label: 'Chief AI' },
      { id: 'designer', label: 'Designer' },
      { id: 'business', label: 'Business' },
      { id: 'researcher', label: 'Researcher' },
      { id: 'other', label: 'Other' },
    ];

    expect(ProjectRoles).toEqual(expectedRoles);
  });
});
