import { useState, useEffect } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronUpDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import TagSelector from './TagSelector';

type Filters = {
  search?: string;
  techTags?: string[];
  domainTags?: string[];
  status?: string[];
  fromDate?: string | null;
  toDate?: string | null;
  sort?: string | null;
};

type SortOption = {
  label: string;
  value: string;
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Trending', value: 'trending' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'Most Liked', value: 'likes' },
  { label: 'Recently Updated', value: 'updated' },
  { label: 'Alphabetical', value: 'alpha' },
];

export default function ProjectSearch({
  filters,
  onFiltersChange,
  techTagsWithCount,
  domainTagsWithCount,
  isDarkMode,
  totalCount = 0,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  techTagsWithCount: Array<{ id: string; name: string; _count?: { projects: number } }>;
  domainTagsWithCount: Array<{ id: string; name: string; _count?: { projects: number } }>;
  isDarkMode: boolean;
  totalCount?: number;
}) {
  const [showTechTagModal, setShowTechTagModal] = useState(false);
  const [showDomainTagModal, setShowDomainTagModal] = useState(false);

  const [localSearch, setLocalSearch] = useState(filters.search ?? '');
  const [selectedTechTags, setSelectedTechTags] = useState<string[]>(
    filters.techTags ?? []
  );
  const [selectedDomainTags, setSelectedDomainTags] = useState<string[]>(
    filters.domainTags ?? []
  );
  const [fromDate, setFromDate] = useState(filters.fromDate ?? '');
  const [toDate, setToDate] = useState(filters.toDate ?? '');
  const [sortBy, setSortBy] = useState<SortOption>(
    SORT_OPTIONS.find(o => o.value === filters.sort) || SORT_OPTIONS[0]
  );

  // keep local in sync
  useEffect(() => {
    setLocalSearch(filters.search ?? '');
    setSelectedTechTags(filters.techTags ?? []);
    setSelectedDomainTags(filters.domainTags ?? []);
    setFromDate(filters.fromDate ?? '');
    setToDate(filters.toDate ?? '');
    if (filters.sort) {
      const found = SORT_OPTIONS.find(o => o.value === filters.sort);
      if (found) setSortBy(found);
    }
  }, [filters]);

  const applyFilters = (override?: Partial<Filters>) => {
    onFiltersChange({
      search: override?.search ?? (localSearch ? localSearch : undefined),
      techTags: override?.techTags ?? selectedTechTags,
      domainTags: override?.domainTags ?? selectedDomainTags,
      fromDate: override?.fromDate ?? (fromDate ? fromDate : null),
      toDate: override?.toDate ?? (toDate ? toDate : null),
      sort: override?.sort ?? sortBy.value,
      status: override?.status ?? (filters.status ?? []),
    });
  };

  const handleResetAll = () => {
    setLocalSearch('');
    setSelectedTechTags([]);
    setSelectedDomainTags([]);
    setFromDate('');
    setToDate('');
    setSortBy(SORT_OPTIONS[0]);

    onFiltersChange({
      search: '',
      techTags: [],
      domainTags: [],
      fromDate: null,
      toDate: null,
      sort: SORT_OPTIONS[0].value,
      status: [], // clear to fetch ALL
    });
  };

  return (
    <div className="mb-6 space-y-4 sm:space-y-6">
      <div
        className={`${
          isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-100'
        } p-3 sm:p-4 rounded-xl border space-y-3 sm:space-y-4`}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className={`w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-lg border ${
                isDarkMode
                  ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400'
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
              } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200`}
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  applyFilters({ search: e.currentTarget.value });
                }
              }}
            />
            <button
              type="button"
              onClick={() => applyFilters({ search: localSearch })}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-indigo-500 text-white rounded"
            >
              Search
            </button>
          </div>

          <Listbox
            value={sortBy}
            onChange={option => {
              setSortBy(option);
              applyFilters({ sort: option.value });
            }}
          >
            <div className="relative w-full sm:w-[200px]">
              <ListboxButton
                className={`w-full flex items-center justify-between px-4 py-2 sm:py-2.5 rounded-lg ${
                  isDarkMode
                    ? 'border border-gray-700 bg-gray-800 text-gray-100'
                    : 'border border-gray-300 bg-white text-gray-900'
                }`}
              >
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
                <ListboxOptions
                  className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto ${
                    isDarkMode
                      ? 'bg-gray-800 border border-gray-700'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  {SORT_OPTIONS.map(option => (
                    <ListboxOption
                      key={option.value}
                      value={option}
                      className={({ selected }) =>
                        `${
                          selected
                            ? isDarkMode
                              ? 'bg-gray-700 text-gray-100'
                              : 'bg-gray-100 text-gray-900'
                            : isDarkMode
                              ? 'text-gray-300'
                              : 'text-gray-700'
                        } cursor-pointer select-none relative py-2 px-4 hover:bg-gray-700/40`
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

        <div className="space-y-2">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-sm text-gray-400">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="mr-1 text-gray-400">Filter by tags:</span>
              <button
                onClick={() => setShowTechTagModal(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-purple-900/30 text-purple-200 hover:bg-purple-900/50 transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span>+ Tech Stack</span>
              </button>
              <button
                onClick={() => setShowDomainTagModal(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-gray-700/50 text-gray-200 hover:bg-gray-700/70 transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <span>+ Domain</span>
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400">From:</span>
              <input
                type="date"
                className={`w-[110px] px-2 py-1 rounded border text-xs ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800 text-gray-100'
                    : 'border-gray-300 bg-white text-gray-800'
                }`}
                value={fromDate}
                onChange={e => {
                  const v = e.target.value;
                  setFromDate(v);
                  applyFilters({ fromDate: v || null });
                }}
              />
              <span className="text-xs text-gray-400">To:</span>
              <input
                type="date"
                className={`w-[110px] px-2 py-1 rounded border text-xs ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800 text-gray-100'
                    : 'border-gray-300 bg-white text-gray-800'
                }`}
                value={toDate}
                onChange={e => {
                  const v = e.target.value;
                  setToDate(v);
                  applyFilters({ toDate: v || null });
                }}
              />
              <button
                type="button"
                className={`ml-2 px-2 py-1 text-xs rounded border ${
                  isDarkMode
                    ? 'border-gray-700 text-gray-200 bg-gray-800 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-100'
                } transition-colors duration-150`}
                onClick={handleResetAll}
                title="Reset all filters"
              >
                Reset
              </button>
            </div>
          </div>

          {(selectedTechTags.length > 0 || selectedDomainTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2">
              {selectedTechTags.map(tagName => (
                <span
                  key={tagName}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2 bg-purple-900/30 text-purple-200 border border-purple-800/30"
                >
                  {tagName}
                  <XMarkIcon
                    className="h-4 w-4 cursor-pointer hover:text-purple-50 transition-colors duration-200"
                    onClick={() => {
                      const next = selectedTechTags.filter(t => t !== tagName);
                      setSelectedTechTags(next);
                      applyFilters({ techTags: next });
                    }}
                  />
                </span>
              ))}
              {selectedDomainTags.map(tagName => (
                <span
                  key={tagName}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2 bg-gray-700/50 text-gray-200 border border-gray-600/30"
                >
                  {tagName}
                  <XMarkIcon
                    className="h-4 w-4 cursor-pointer hover:text-gray-50 transition-colors duration-200"
                    onClick={() => {
                      const next = selectedDomainTags.filter(
                        t => t !== tagName
                      );
                      setSelectedDomainTags(next);
                      applyFilters({ domainTags: next });
                    }}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs sm:text-sm text-gray-400 flex items-center gap-2">
        <span className="font-medium text-gray-300">{totalCount}</span> projects
        found
      </div>

      <TagSelector
        show={showTechTagModal}
        onClose={() => setShowTechTagModal(false)}
        tags={techTagsWithCount}
        selectedTags={selectedTechTags.map(tag => ({ id: tag }))}
        onSelect={tagName => {
          if (selectedTechTags.includes(tagName)) return;
          const next = [...selectedTechTags, tagName];
          setSelectedTechTags(next);
          applyFilters({ techTags: next });
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
        onSelect={tagName => {
          if (selectedDomainTags.includes(tagName)) return;
          const next = [...selectedDomainTags, tagName];
          setSelectedDomainTags(next);
          applyFilters({ domainTags: next });
          setShowDomainTagModal(false);
        }}
        type="domain"
        allowCreate={false}
      />
    </div>
  );
}
