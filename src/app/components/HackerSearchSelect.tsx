'use client';

import { useMemo, useState } from 'react';
import { useManagementClasses } from './ManagementSurface';
import type { HackerSelectionOption } from '@/types/hacker';

type HackerSearchSelectProps = {
  ariaLabel: string;
  hackers: HackerSelectionOption[];
  query: string;
  selectedHacker: HackerSelectionOption | null;
  onQueryChange: (query: string) => void;
  onSelectedHackerChange: (hacker: HackerSelectionOption | null) => void;
  placeholder?: string;
  noResultsText?: string;
  disabled?: boolean;
};

export function HackerSearchSelect({
  ariaLabel,
  hackers,
  query,
  selectedHacker,
  onQueryChange,
  onSelectedHackerChange,
  placeholder = 'Hacker name',
  noResultsText = 'No hackers found.',
  disabled = false,
}: HackerSearchSelectProps) {
  const classes = useManagementClasses();
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const optionsId = `${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-options`;

  const filteredHackers = useMemo(() => {
    if (!normalizedQuery || selectedHacker) return [];

    return hackers
      .filter(hacker => {
        const name = hacker.name.toLowerCase();
        const email = hacker.email?.toLowerCase() ?? '';
        return name.includes(normalizedQuery) || email.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [hackers, normalizedQuery, selectedHacker]);

  function updateQuery(value: string) {
    onQueryChange(value);
    onSelectedHackerChange(null);
    setIsOpen(true);
  }

  function chooseHacker(hacker: HackerSelectionOption) {
    onSelectedHackerChange(hacker);
    onQueryChange(hacker.name);
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <input
        aria-label={ariaLabel}
        aria-controls={optionsId}
        autoComplete="off"
        className={`${classes.input} w-full`}
        disabled={disabled}
        value={query}
        onChange={event => updateQuery(event.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && normalizedQuery && (
        <div
          id={optionsId}
          role="listbox"
          className={`absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-md border shadow-xl ring-1 ${
            classes.isDarkMode
              ? 'border-gray-600 bg-gray-800 text-gray-100 shadow-black/40 ring-gray-700'
              : 'border-gray-400 bg-gray-100 text-gray-900 shadow-gray-300/80 ring-gray-200'
          }`}
        >
          {filteredHackers.map(hacker => (
            <button
              key={hacker.id}
              role="option"
              aria-selected={false}
              type="button"
              className={`block w-full border-b px-4 py-3 text-left text-sm transition last:border-b-0 ${
                classes.isDarkMode
                  ? 'border-gray-700 hover:bg-gray-700'
                  : 'border-gray-200 hover:bg-white'
              }`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => chooseHacker(hacker)}
            >
              <span className="block font-semibold">{hacker.name}</span>
              {hacker.email && (
                <span className={`block ${classes.mutedText}`}>
                  {hacker.email}
                </span>
              )}
            </button>
          ))}
          {filteredHackers.length === 0 && (
            <div className={`px-4 py-3 text-sm ${classes.mutedText}`}>
              {noResultsText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
