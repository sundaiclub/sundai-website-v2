import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, FunnelIcon, ChevronUpDownIcon, XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { Project } from './Project';
import TagSelector from './TagSelector';

type SortOption = {
  label: string;
  value: string;
  sortFn: (a: Project, b: Project) => number;
};

const SORT_OPTIONS: SortOption[] = [
  {
    label: "Trending",
    value: "trending",
    sortFn: (a: Project, b: Project) => {
      const scoreA = calculateTrendingScore(a);
      const scoreB = calculateTrendingScore(b);
      return scoreB - scoreA;
    }
  },
  {
    label: "Newest First",
    value: "newest",
    sortFn: (a: Project, b: Project) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
    }
  },
  {
    label: "Oldest First",
    value: "oldest",
    sortFn: (a: Project, b: Project) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return isNaN(dateB) || isNaN(dateA) ? 0 : dateA - dateB;
    }
  },
  {
    label: "Most Liked",
    value: "likes",
    sortFn: (a: Project, b: Project) => (b.likes?.length || 0) - (a.likes?.length || 0)
  },
  {
    label: "Recently Updated",
    value: "updated",
    sortFn: (a: Project, b: Project) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
    }
  },
  {
    label: "Alphabetical",
    value: "alpha",
    sortFn: (a: Project, b: Project) => a.title.localeCompare(b.title)
  }
];

// Helper function to format date for input
const formatDateForInput = (date: string) => {
  if (!date) return '';
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Helper function to parse date from input
const parseDateFromInput = (dateStr: string) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
};

// Add this helper function to count projects per tag
const getTagCount = (tagName: string, projects: Project[]) => {
  return projects.filter(project => 
    project.techTags.some(t => t.name === tagName) || 
    project.domainTags.some(t => t.name === tagName)
  ).length;
};

const calculateTrendingScore = (project: Project): number => {
  const likesCount = project.likes?.length || 0;
  const projectAgeInDays = Math.floor(
    (Date.now() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const logLikes = Math.log(likesCount + 1); // +1 to avoid log(0)
  const decayFactor = Math.exp(-projectAgeInDays / 30); // Decay approximately every 30 days
  return logLikes * decayFactor;
};

export default function ProjectSearch({ 
  projects,
  onFilteredProjectsChange,
  urlFilters = {}
}: {
  projects: Project[];
  onFilteredProjectsChange: (projects: Project[]) => void;
  urlFilters?: {
    techTags?: string[];
    domainTags?: string[];
    search?: string;
    fromDate?: string;
    toDate?: string;
    status?: string[];
    sort?: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL parameters
  const [searchTerm, setSearchTerm] = useState(urlFilters.search || '');
  const [selectedStatus, setSelectedStatus] = useState<string[]>(urlFilters.status || []);
  const [selectedTechTags, setSelectedTechTags] = useState<string[]>(urlFilters.techTags || []);
  const [selectedDomainTags, setSelectedDomainTags] = useState<string[]>(urlFilters.domainTags || []);
  const [sortBy, setSortBy] = useState<SortOption>(
    SORT_OPTIONS.find(option => option.value === urlFilters.sort) || SORT_OPTIONS[0]
  );
  const [showBroken, setShowBroken] = useState(true);
  const [showTechTagModal, setShowTechTagModal] = useState(false);
  const [showDomainTagModal, setShowDomainTagModal] = useState(false);
  
  // Date filtering state
  const [fromDate, setFromDate] = useState(formatDateForInput(urlFilters.fromDate || ''));
  const [toDate, setToDate] = useState(formatDateForInput(urlFilters.toDate || ''));

  // Sync state with URL parameters when they change
  useEffect(() => {
    setSearchTerm(urlFilters.search || '');
    setSelectedStatus(urlFilters.status || []);
    setSelectedTechTags(urlFilters.techTags || []);
    setSelectedDomainTags(urlFilters.domainTags || []);
    setSortBy(SORT_OPTIONS.find(option => option.value === urlFilters.sort) || SORT_OPTIONS[0]);
    setFromDate(formatDateForInput(urlFilters.fromDate || ''));
    setToDate(formatDateForInput(urlFilters.toDate || ''));
  }, [urlFilters]);

  // Function to update URL parameters
  const updateURL = (newFilters: any) => {
    const params = new URLSearchParams();
    
    // Add search term
    if (newFilters.searchTerm) {
      params.set('search', newFilters.searchTerm);
    }
    
    // Add tech tags
    newFilters.selectedTechTags?.forEach((tag: string) => {
      params.append('tech_tag', tag);
    });
    
    // Add domain tags
    newFilters.selectedDomainTags?.forEach((tag: string) => {
      params.append('domain_tag', tag);
    });
    
    // Add status
    newFilters.selectedStatus?.forEach((status: string) => {
      params.append('status', status);
    });
    
    // Add dates
    if (newFilters.fromDate) {
      params.set('from_date', newFilters.fromDate);
    }
    if (newFilters.toDate) {
      params.set('to_date', newFilters.toDate);
    }
    
    // Add sort
    if (newFilters.sortBy?.value && newFilters.sortBy.value !== 'trending') {
      params.set('sort', newFilters.sortBy.value);
    }
    
    const newURL = params.toString() ? `?${params.toString()}` : '/projects';
    router.push(newURL, { scroll: false });
  };

  // Get unique tags from all projects
  const allTechTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach(project => {
      project.techTags.forEach(tag => tags.add(tag.name));
    });
    return Array.from(tags).sort();
  }, [projects]);

  const allDomainTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach(project => {
      project.domainTags.forEach(tag => tags.add(tag.name));
    });
    return Array.from(tags).sort();
  }, [projects]);

  // Modify the tag arrays to include sorting by count
  const techTagsWithCount = allTechTags
    .map(tag => ({
      id: tag,
      name: tag,
      _count: {
        projects: projects.filter(p => 
          p.techTags.some(t => t.name === tag)
        ).length
      }
    }))
    .sort((a, b) => b._count.projects - a._count.projects); // Sort by count descending

  const domainTagsWithCount = allDomainTags
    .map(tag => ({
      id: tag,
      name: tag,
      _count: {
        projects: projects.filter(p => 
          p.domainTags.some(t => t.name === tag)
        ).length
      }
    }))
    .sort((a, b) => b._count.projects - a._count.projects); // Sort by count descending

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter(project => {
        // Filter by search term
        const searchMatch = 
          project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.preview.toLowerCase().includes(searchTerm.toLowerCase());

        // Filter by status
        const statusMatch = selectedStatus.length === 0 || 
          selectedStatus.includes(project.status);

        // Filter by tech tags
        const techTagMatch = selectedTechTags.length === 0 ||
          selectedTechTags.every(tag => 
            project.techTags.some(t => t.name === tag)
          );

        // Filter by domain tags
        const domainTagMatch = selectedDomainTags.length === 0 ||
          selectedDomainTags.every(tag => 
            project.domainTags.some(t => t.name === tag)
          );

        // Filter by date range - convert to local timezone first to avoid UTC offset issues
        const projectDate = new Date(project.startDate);
        const projectDateStr = `${projectDate.getFullYear()}-${String(projectDate.getMonth() + 1).padStart(2, '0')}-${String(projectDate.getDate()).padStart(2, '0')}`;
        
        // Debug logging if needed
        // if (fromDate || toDate) {
        //   console.log('DEBUG Filter:', {
        //     projectTitle: project.title,
        //     projectStartDate: project.startDate,
        //     projectDateStr,
        //     fromDate,
        //     toDate,
        //     fromMatch: !fromDate || projectDateStr >= fromDate,
        //     toMatch: !toDate || projectDateStr <= toDate
        //   });
        // }
        
        const dateMatch = (!fromDate || projectDateStr >= fromDate) &&
                         (!toDate || projectDateStr <= toDate);

        // Filter broken projects
        const brokenMatch = showBroken || !project.is_broken;

        return searchMatch && statusMatch && techTagMatch && domainTagMatch && dateMatch && brokenMatch;
      })
      .sort((a, b) => {
        try {
          return sortBy.sortFn(a, b);
        } catch (error) {
          console.error('Sorting error:', error);
          return 0;
        }
      });
  }, [projects, searchTerm, selectedStatus, selectedTechTags, selectedDomainTags, fromDate, toDate, sortBy, showBroken]);

  // Update parent component with filtered projects
  useEffect(() => {
    onFilteredProjectsChange(filteredProjects);
  }, [filteredProjects, onFilteredProjectsChange]);

  // Update URL when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL({
        searchTerm,
        selectedTechTags,
        selectedDomainTags,
        selectedStatus,
        fromDate,
        toDate,
        sortBy
      });
    }, 500); // Debounce URL updates
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedTechTags, selectedDomainTags, selectedStatus, fromDate, toDate, sortBy]);

  return (
    <div className="mb-6 space-y-4 sm:space-y-6">
      {/* Search and Filter Section */}
      <div className="bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-700/50 space-y-3 sm:space-y-4">
        {/* Search Bar and Sort - Stack on mobile, row on desktop */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-lg border border-gray-700 
                bg-gray-800 text-gray-100 placeholder-gray-400
                focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                transition-colors duration-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sort Dropdown - Full width on mobile */}
          <Listbox value={sortBy} onChange={setSortBy}>
            <div className="relative w-full sm:w-[200px]">
              <ListboxButton className="w-full flex items-center justify-between px-4 py-2 sm:py-2.5 
                border border-gray-700 rounded-lg bg-gray-800 text-gray-100
                hover:bg-gray-750 transition-colors duration-200">
                <span className="flex items-center gap-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm sm:text-base">{sortBy.label}</span>
                </span>
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
              </ListboxButton>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <ListboxOptions className="absolute z-10 w-full mt-1 bg-gray-800 border 
                  border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto scrollbar-thin
                  scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                  {SORT_OPTIONS.map((option) => (
                    <ListboxOption
                      key={option.value}
                      value={option}
                      className={({ selected }) =>
                        `${selected ? 'bg-gray-700 text-gray-100' : 'text-gray-300'}
                        cursor-pointer select-none relative py-2 px-4 hover:bg-gray-700`
                      }
                    >
                      {option.label}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Tag Selection Area - Adjust spacing and button sizes */}
        <div className="space-y-2">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-sm text-gray-400">
            {/* Left: Tag selectors */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="mr-1">Filter by tags:</span>
              <button
                onClick={() => setShowTechTagModal(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-purple-900/30 text-purple-300 
                  hover:bg-purple-900/50 transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span>+ Tech Stack</span>
              </button>
              <button
                onClick={() => setShowDomainTagModal(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-gray-700/50 text-gray-300 
                  hover:bg-gray-700/70 transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span>+ Domain</span>
              </button>
            </div>
            {/* Right: Date pickers with labels */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400">From:</span>
              <input
                type="date"
                className="w-[110px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-xs text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                placeholder="From"
                title="From date"
                style={{ minWidth: 0 }}
              />
              <span className="text-xs text-gray-400">To:</span>
              <input
                type="date"
                className="w-[110px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-xs text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                placeholder="To"
                title="To date"
                style={{ minWidth: 0 }}
              />
              {/* Reset Dates Button */}
              <button
                type="button"
                className="ml-2 px-2 py-1 text-xs rounded border border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-gray-200 transition-colors duration-150"
                onClick={() => { setFromDate(''); setToDate(''); }}
                disabled={!fromDate && !toDate}
                title="Reset date filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Selected Tags Display - Improve wrapping and spacing */}
          {(selectedTechTags.length > 0 || selectedDomainTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2">
              {selectedTechTags.map((tagName) => (
                <span
                  key={tagName}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2 
                    bg-purple-900/30 text-purple-300 border border-purple-800/30"
                >
                  {tagName}
                  <XMarkIcon
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 cursor-pointer hover:text-purple-200 transition-colors duration-200"
                    onClick={() => setSelectedTechTags(tags => tags.filter(t => t !== tagName))}
                  />
                </span>
              ))}
              {selectedDomainTags.map((tagName) => (
                <span
                  key={tagName}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2 
                    bg-gray-700/50 text-gray-300 border border-gray-600/30"
                >
                  {tagName}
                  <XMarkIcon
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 cursor-pointer hover:text-gray-200 transition-colors duration-200"
                    onClick={() => setSelectedDomainTags(tags => tags.filter(t => t !== tagName))}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results Count - Adjust text size */}
      <div className="text-xs sm:text-sm text-gray-400 flex items-center gap-2">
        <span className="font-medium text-gray-300">{filteredProjects.length}</span> 
        projects found
      </div>

      {/* Tag Selectors */}
      <TagSelector
        show={showTechTagModal}
        onClose={() => setShowTechTagModal(false)}
        tags={techTagsWithCount}
        selectedTags={selectedTechTags.map(tag => ({ id: tag }))}
        onSelect={(tagName) => {
          setSelectedTechTags(prev => [...prev, tagName]);
          setShowTechTagModal(false);
        }}
        type="tech"
        allowCreate={false}
      />
      <TagSelector
        show={showDomainTagModal}
        onClose={() => setShowDomainTagModal(false)}
        tags={domainTagsWithCount}
        selectedTags={selectedDomainTags.map(tag => ({ id: tag }))}
        onSelect={(tagName) => {
          setSelectedDomainTags(prev => [...prev, tagName]);
          setShowDomainTagModal(false);
        }}
        type="domain"
        allowCreate={false}
      />
    </div>
  );
}

// Helper MultiSelect Component
function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder 
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}) {
  return (
    <Listbox value={selected} onChange={onChange} multiple>
      <div className="relative min-w-[200px]">
        <ListboxButton className="w-full flex items-center justify-between px-4 py-2 
          border border-gray-700 rounded-lg bg-gray-800 text-gray-100">
          <span className="block truncate">
            {selected.length === 0 ? placeholder : `${selected.length} selected`}
          </span>
          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
        </ListboxButton>
        <Transition
          enter="transition duration-100 ease-out"
          enterFrom="transform scale-95 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-75 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-95 opacity-0"
        >
          <ListboxOptions className="absolute z-10 w-full mt-1 bg-gray-800 border 
            border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto scrollbar-thin
            scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {options.map((option) => (
              <ListboxOption
                key={option}
                value={option}
                className={({ selected }) =>
                  `${selected ? 'bg-gray-700 text-gray-100' : 'text-gray-300'}
                  cursor-pointer select-none relative py-2 px-4 hover:bg-gray-700`
                }
              >
                {({ selected }) => (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selected}
                      className="mr-2 rounded border-gray-600 bg-gray-700 text-indigo-500 
                        focus:ring-indigo-500 focus:ring-offset-gray-800"
                      readOnly
                    />
                    {option}
                  </div>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
} 