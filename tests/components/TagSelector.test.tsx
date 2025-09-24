import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagSelector from '../../src/app/components/TagSelector';

// Mock dependencies
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const mockTechTags = [
  { id: '1', name: 'React', _count: { projects: 5 } },
  { id: '2', name: 'Vue', _count: { projects: 3 } },
  { id: '3', name: 'Angular', _count: { projects: 2 } },
];

const mockDomainTags = [
  { id: '1', name: 'AI', _count: { projects: 8 } },
  { id: '2', name: 'Web', _count: { projects: 6 } },
  { id: '3', name: 'Mobile', _count: { projects: 4 } },
];

const defaultProps = {
  show: true,
  onClose: jest.fn(),
  tags: mockTechTags,
  selectedTags: [],
  onSelect: jest.fn(),
  type: 'tech' as const,
  allowCreate: true,
};

describe('TagSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render modal when show is true', () => {
    render(<TagSelector {...defaultProps} />);
    
    expect(screen.getByText('Select Tags')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tags...')).toBeInTheDocument();
  });

  it('should not render modal when show is false', () => {
    render(<TagSelector {...defaultProps} show={false} />);
    
    expect(screen.queryByText('Select Tags')).not.toBeInTheDocument();
  });

  it('should display all tags initially', () => {
    render(<TagSelector {...defaultProps} />);
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();
  });

  it('should filter tags based on search term', () => {
    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Vue')).not.toBeInTheDocument();
    expect(screen.queryByText('Angular')).not.toBeInTheDocument();
  });

  it('should call onSelect when tag is clicked', () => {
    const onSelect = jest.fn();
    render(<TagSelector {...defaultProps} onSelect={onSelect} />);
    
    const reactTag = screen.getByText('React');
    fireEvent.click(reactTag);
    
    expect(onSelect).toHaveBeenCalledWith('1', 'tech');
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<TagSelector {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should filter out selected tags from the list', () => {
    const selectedTags = [{ id: '1' }]; // React is selected
    render(<TagSelector {...defaultProps} selectedTags={selectedTags} />);
    
    // React should not be visible since it's selected
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    // Other tags should still be visible
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();
  });

  it('should show project count for tags', () => {
    render(<TagSelector {...defaultProps} />);
    
    expect(screen.getByText('5')).toBeInTheDocument(); // React count
    expect(screen.getByText('3')).toBeInTheDocument(); // Vue count
    expect(screen.getByText('2')).toBeInTheDocument(); // Angular count
  });

  it('should show "No matching tags found" when search returns no results', () => {
    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NonExistentTag' } });
    
    expect(screen.getByText('No matching tags found')).toBeInTheDocument();
  });

  it('should show create tag input when allowCreate is true', () => {
    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NewTag' } });
    
    expect(screen.getByText('+ Create tag "NewTag"')).toBeInTheDocument();
  });

  it('should not show create tag input when allowCreate is false', () => {
    render(<TagSelector {...defaultProps} allowCreate={false} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NewTag' } });
    
    expect(screen.queryByText('+ Create tag "NewTag"')).not.toBeInTheDocument();
  });

  it('should create new tag when create button is clicked', async () => {
    const mockResponse = { id: '4', name: 'NewTag' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NewTag' } });
    
    const createButton = screen.getByText('+ Create tag "NewTag"');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/tech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'NewTag' }),
      });
    });
  });

  it('should handle create tag error', async () => {
    const { toast } = require('react-hot-toast');
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NewTag' } });
    
    const createButton = screen.getByText('+ Create tag "NewTag"');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create tag');
    });
  });

  it('should show error for duplicate tag names', async () => {
    const { toast } = require('react-hot-toast');
    
    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    const createButton = screen.getByText('+ Create tag "React"');
    fireEvent.click(createButton);
    
    expect(toast.error).toHaveBeenCalledWith('A tag with this name already exists');
  });

  it('should show loading state while creating tag', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ id: '4', name: 'NewTag' }),
      }), 100))
    );

    render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'NewTag' } });
    
    const createButton = screen.getByText('+ Create tag "NewTag"');
    fireEvent.click(createButton);
    
    expect(screen.getByText('Creating...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
    });
  });

  it('should handle domain tags correctly', () => {
    render(<TagSelector {...defaultProps} tags={mockDomainTags} type="domain" />);
    
    expect(screen.getByText('Select Tags')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
  });

  it('should maintain search state when modal is closed and reopened', () => {
    const { rerender } = render(<TagSelector {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    // Close modal
    rerender(<TagSelector {...defaultProps} show={false} />);
    
    // Reopen modal
    rerender(<TagSelector {...defaultProps} show={true} />);
    
    // Search should be maintained (component doesn't clear search on reopen)
    expect(searchInput).toHaveValue('React');
  });

  it('should handle empty tags array', () => {
    render(<TagSelector {...defaultProps} tags={[]} />);
    
    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('should handle tags without project counts', () => {
    const tagsWithoutCounts = [
      { id: '1', name: 'React' },
      { id: '2', name: 'Vue' },
    ];
    
    render(<TagSelector {...defaultProps} tags={tagsWithoutCounts} />);
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    // Should not show count if _count is not available
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });
});
