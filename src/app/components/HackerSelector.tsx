import { XMarkIcon } from "@heroicons/react/24/solid";
import { useState } from 'react';

export const ProjectRoles = [
    { id: "hacker", label: "Hacker" },
    { id: "developer", label: "Developer" },
    { id: "caio", label: "Chief AI" },
    { id: "designer", label: "Designer" },
    { id: "business", label: "Business" },
    { id: "researcher", label: "Researcher" },
    { id: "other", label: "Other" },
  ];

export type Hacker = {
  id: string;
  name: string;
  email: string;
};

export type TeamMember = Hacker & {
    role: string;
  };

interface HackerSelectorProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  isDarkMode: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredHackers: Hacker[];
  title?: string;
  singleSelect?: boolean;
  selectedIds?: string[];
  showRoleSelector?: boolean;
  handleAddMember?: (hacker: Hacker) => void;
  onAddMemberWithRole?: (hacker: Hacker, role: string) => void;
}

export function HackerSelector({
  showModal,
  setShowModal,
  isDarkMode,
  searchTerm,
  setSearchTerm,
  filteredHackers,
  handleAddMember,
  title = "Select Hackers",
  singleSelect = false,
  selectedIds = [],
  showRoleSelector = false,
  onAddMemberWithRole,
}: HackerSelectorProps) {
  const [selectedRole, setSelectedRole] = useState(ProjectRoles[0].id);

  const handleHackerClick = (hacker: Hacker) => {
    if (showRoleSelector && onAddMemberWithRole) {
      onAddMemberWithRole(hacker, selectedRole);
    } else if (handleAddMember) {
      handleAddMember(hacker);
    }
    if (!singleSelect) {
      setShowModal(false);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-lg p-6 w-full max-w-md m-4 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-semibold font-space-mono ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            {title}
          </h2>
          <button
            onClick={() => setShowModal(false)}
            className={`${
              isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-gray-100' 
              : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
          } font-fira-code`}
        />

        {showRoleSelector && (
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Role
            </label>
            <div className="flex flex-wrap gap-2">
              {ProjectRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedRole === role.id
                      ? "bg-indigo-600 text-white"
                      : isDarkMode 
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-60 overflow-y-auto mt-4">
          {filteredHackers.map((hacker) => {
            const isSelected = selectedIds.includes(hacker.id);
            return (
              <button
                key={hacker.id}
                onClick={() => handleHackerClick(hacker)}
                className={`w-full text-left px-4 py-2 rounded-md flex items-center justify-between group ${
                  isDarkMode 
                    ? isSelected
                      ? 'bg-gray-700 text-gray-100'
                      : 'hover:bg-gray-700 text-gray-300'
                    : isSelected
                      ? 'bg-indigo-50 text-indigo-900'
                      : 'hover:bg-gray-100 text-gray-900'
                }`}
              >
                <div>
                  <div className={`font-medium`}>
                    {hacker.name}
                  </div>
                  <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    {hacker.email}
                  </div>
                </div>
                {isSelected && (
                  <span className={`${
                    isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
          {filteredHackers.length === 0 && (
            <p className={`text-center py-4 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              No members found
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowModal(false)}
            className={`px-4 py-2 rounded-md ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
