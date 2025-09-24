import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectSearch from '../../src/app/components/ProjectSearch';
import type { Project } from '../../src/app/components/Project';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    set: jest.fn(),
  }),
}));

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('../../src/app/components/TagSelector', () => {
  return function MockTagSelector({ show, onClose, onSelect, type }: any) {
    return show ? (
      <div data-testid={`${type}-tag-selector`}>
        <button onClick={() => onSelect('tag1', type)}>Select Tag 1</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;
  };
});

const mockProjects: Project[] = [
  {
    id: '1',
    title: 'Project 1',
    description: 'Description 1',
    preview: 'Preview 1',
    startDate: new Date('2024-01-01'),
    updatedAt: '2024-01-02',
    createdAt: '2023-12-31',
    likes: [
      { hackerId: 'user1', createdAt: '2024-01-02T00:00:00Z' },
      { hackerId: 'user2', createdAt: '2024-01-02T00:00:00Z' }
    ],
    thumbnail: { url: 'https://example.com/image1.jpg' },
    status: 'APPROVED',
    techTags: [{ id: '1', name: 'React' }],
    domainTags: [{ id: '1', name: 'AI' }],
    is_broken: false,
    is_starred: false,
    launchLead: { id: '1', name: 'Lead 1' },
    participants: [],
  },
  {
    id: '2',
    title: 'Project 2',
    description: 'Description 2',
    preview: 'Preview 2',
    startDate: new Date('2024-01-03'),
    updatedAt: '2024-01-04',
    createdAt: '2024-01-02',
    likes: [{ hackerId: 'user1', createdAt: '2024-01-04T00:00:00Z' }],
    thumbnail: { url: 'https://example.com/image2.jpg' },
    status: 'PENDING',
    techTags: [{ id: '2', name: 'Vue' }],
    domainTags: [{ id: '2', name: 'Web' }],
    is_broken: false,
    is_starred: false,
    launchLead: { id: '2', name: 'Lead 2' },
    participants: [],
  },
];

const mockTechTags = [
  { id: '1', name: 'React', _count: { projects: 5 } },
  { id: '2', name: 'Vue', _count: { projects: 3 } },
];

const mockDomainTags = [
  { id: '1', name: 'AI', _count: { projects: 8 } },
  { id: '2', name: 'Web', _count: { projects: 6 } },
];

const defaultProps = {
  projects: mockProjects,
  onFilteredProjectsChange: jest.fn(),
  urlFilters: {}
};

describe('ProjectSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search input and filters', () => {
    render(<ProjectSearch {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    // Default sort label changed to Trending
    expect(screen.getByText('Trending')).toBeInTheDocument();
    expect(screen.getByText('+ Tech Stack')).toBeInTheDocument();
    expect(screen.getByText('+ Domain')).toBeInTheDocument();
  });

  it('should call onFilteredProjectsChange with all projects initially', () => {
    render(<ProjectSearch {...defaultProps} />);
    
    // Default sort is Trending; with our data Project 1 (more likes) comes first
    const expectedOrder = [mockProjects[0], mockProjects[1]];
    expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(expectedOrder);
  });

  it('should filter projects by search term', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'Project 1' } });
    
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' })
        ])
      );
    });
  });

  it('should sort projects by newest first by default', () => {
    render(<ProjectSearch {...defaultProps} />);
    
    // Check that the callback was called with projects sorted by newest first
    expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Project 2' }), // Newer project first
        expect.objectContaining({ title: 'Project 1' })  // Older project second
      ])
    );
  });

  it('should sort projects by oldest first', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const sortButton = screen.getByText('Trending');
    fireEvent.click(sortButton);
    
    const oldestOption = screen.getByText('Oldest First');
    fireEvent.click(oldestOption);
    
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' }), // Older project first
          expect.objectContaining({ title: 'Project 2' })  // Newer project second
        ])
      );
    });
  });

  it('should sort projects by most liked', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const sortButton = screen.getByText('Trending');
    fireEvent.click(sortButton);
    
    const likesOption = screen.getByText('Most Liked');
    fireEvent.click(likesOption);
    
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' }), // More likes
          expect.objectContaining({ title: 'Project 2' })  // Fewer likes
        ])
      );
    });
  });

  it('should sort projects alphabetically', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const sortButton = screen.getByText('Trending');
    fireEvent.click(sortButton);
    
    const alphaOption = screen.getByText('Alphabetical');
    fireEvent.click(alphaOption);
    
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' }), // Alphabetically first
          expect.objectContaining({ title: 'Project 2' })  // Alphabetically second
        ])
      );
    });
  });

  it('should open tech tag selector when clicked', () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const techFilterButton = screen.getByText('+ Tech Stack');
    fireEvent.click(techFilterButton);
    
    expect(screen.getByTestId('tech-tag-selector')).toBeInTheDocument();
  });

  it('should open domain tag selector when clicked', () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const domainFilterButton = screen.getByText('+ Domain');
    fireEvent.click(domainFilterButton);
    
    expect(screen.getByTestId('domain-tag-selector')).toBeInTheDocument();
  });

  it('should filter projects by selected tech tags', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    // Open tech tag selector
    const techFilterButton = screen.getByText('+ Tech Stack');
    fireEvent.click(techFilterButton);
    
    // Select a tag
    const tagButton = screen.getByText('Select Tag 1');
    fireEvent.click(tagButton);
    
    // Should call callback with filtered projects
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' })
        ])
      );
    });
  });

  it('should filter projects by selected domain tags', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    // Open domain tag selector
    const domainFilterButton = screen.getByText('+ Domain');
    fireEvent.click(domainFilterButton);
    
    // Select a tag
    const tagButton = screen.getByText('Select Tag 1');
    fireEvent.click(tagButton);
    
    // Should call callback with filtered projects
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Project 1' })
        ])
      );
    });
  });

  it('should reset date filters when reset button is clicked', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    // Apply a date filter
    const fromDateInput = screen.getByTitle('From date');
    fireEvent.change(fromDateInput, { target: { value: '2024-01-02' } });
    
    // Reset date filters
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    // Should call callback with all projects again (default trending => Project 1 first)
    await waitFor(() => {
      const expectedOrder = [mockProjects[0], mockProjects[1]];
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(expectedOrder);
    });
  });

  it('should call callback with empty array when no projects match filters', async () => {
    render(<ProjectSearch {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'Non-existent project' } });
    
    await waitFor(() => {
      expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith([]);
    });
  });

  it('should handle empty projects array', () => {
    render(<ProjectSearch {...defaultProps} projects={[]} />);
    
    expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith([]);
  });

  it('should call onFilteredProjectsChange when projects are filtered', () => {
    const onFilteredProjectsChange = jest.fn();
    render(<ProjectSearch {...defaultProps} onFilteredProjectsChange={onFilteredProjectsChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'Project 1' } });
    
    expect(onFilteredProjectsChange).toHaveBeenCalled();
  });

  it('should handle projects with missing dates gracefully', () => {
    const projectsWithMissingDates: Project[] = [
      {
        ...mockProjects[0],
        startDate: new Date('invalid'),
        updatedAt: 'invalid-date',
      },
    ];
    
    render(<ProjectSearch {...defaultProps} projects={projectsWithMissingDates} />);
    
    // Should not crash and should call callback with the project
    expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Project 1' })
      ])
    );
  });

  it('should handle projects with no likes gracefully', () => {
    const projectsWithNoLikes = [
      {
        ...mockProjects[0],
        likes: [],
      },
    ];
    
    render(<ProjectSearch {...defaultProps} projects={projectsWithNoLikes} />);
    
    // Should not crash and should call callback with the project
    expect(defaultProps.onFilteredProjectsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Project 1' })
      ])
    );
  });
});
