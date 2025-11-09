import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectSearch from '../../src/app/components/ProjectSearch';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('../../src/app/components/TagSelector', () => {
  return function MockTagSelector({ show, onClose, onSelect, type }: any) {
    return show ? (
      <div data-testid={`${type}-tag-selector`}>
        <button onClick={() => onSelect('tag1')}>Select Tag 1</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;
  };
});

describe('ProjectSearch (filters-only UI)', () => {
  const onFiltersChange = jest.fn();
  const techTagsWithCount = [
    { id: '1', name: 'React', _count: { projects: 5 } },
    { id: '2', name: 'Vue', _count: { projects: 3 } },
  ];
  const domainTagsWithCount = [
    { id: '1', name: 'AI', _count: { projects: 8 } },
    { id: '2', name: 'Web', _count: { projects: 6 } },
  ];
  const baseFilters = {
    search: '',
    techTags: [],
    domainTags: [],
    fromDate: null as string | null,
    toDate: null as string | null,
    sort: 'trending' as string | null,
    status: [] as string[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders inputs and default sort', () => {
    render(
      <ProjectSearch
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        techTagsWithCount={techTagsWithCount}
        domainTagsWithCount={domainTagsWithCount}
        isDarkMode={false}
        totalCount={0}
      />
    );

    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    expect(screen.getByText('Trending')).toBeInTheDocument();
    expect(screen.getByText('+ Tech Stack')).toBeInTheDocument();
    expect(screen.getByText('+ Domain')).toBeInTheDocument();
  });

  it('applies search on enter and button click', () => {
    render(
      <ProjectSearch
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        techTagsWithCount={techTagsWithCount}
        domainTagsWithCount={domainTagsWithCount}
        isDarkMode={false}
        totalCount={10}
      />
    );

    const input = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(input, { target: { value: 'AI' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'AI' }));

    fireEvent.change(input, { target: { value: 'React' } });
    const searchBtn = screen.getByText('Search');
    fireEvent.click(searchBtn);
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'React' }));
  });

  it('changes sort option', () => {
    render(
      <ProjectSearch
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        techTagsWithCount={techTagsWithCount}
        domainTagsWithCount={domainTagsWithCount}
        isDarkMode={false}
        totalCount={0}
      />
    );
    fireEvent.click(screen.getByText('Trending'));
    fireEvent.click(screen.getByText('Oldest First'));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ sort: 'oldest' }));
  });

  it('opens tag selectors and selects a tech tag', () => {
    render(
      <ProjectSearch
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        techTagsWithCount={techTagsWithCount}
        domainTagsWithCount={domainTagsWithCount}
        isDarkMode={false}
        totalCount={0}
      />
    );
    fireEvent.click(screen.getByText('+ Tech Stack'));
    expect(screen.getByTestId('tech-tag-selector')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Select Tag 1'));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ techTags: expect.arrayContaining(['tag1']) }));
  });

  it('sets date filters and reset', () => {
    render(
      <ProjectSearch
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        techTagsWithCount={techTagsWithCount}
        domainTagsWithCount={domainTagsWithCount}
        isDarkMode={false}
        totalCount={0}
      />
    );
    const dateInputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const [searchInput] = dateInputs; // search input is also textbox; safer to use querySelector by type=date
    const dateFields = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    const [fromInput, toInput] = dateFields;
    fireEvent.change(fromInput, { target: { value: '2024-01-02' } });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ fromDate: '2024-01-02' }));
    fireEvent.change(toInput, { target: { value: '2024-01-10' } });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ toDate: '2024-01-10' }));

    fireEvent.click(screen.getByText('Reset'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      search: '',
      techTags: [],
      domainTags: [],
      fromDate: null,
      toDate: null,
      sort: 'trending',
      status: [],
    });
  });
});


