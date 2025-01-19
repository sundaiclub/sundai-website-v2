import { XMarkIcon } from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  avatar?: {
    url: string;
  } | null;
};

export const ProjectRoles = [
  { id: "hacker", label: "Hacker" },
  { id: "developer", label: "Developer" },
  { id: "caio", label: "Chief AI" },
  { id: "designer", label: "Designer" },
  { id: "business", label: "Business" },
  { id: "researcher", label: "Researcher" },
  { id: "other", label: "Other" },
];

interface HackerSelectorProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  isDarkMode: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredHackers: any[];
  title: string;
  selectedIds: string[];
  showRoleSelector: boolean;
  singleSelect?: boolean;
  handleAddMember?: (hacker: any) => void;
  onAddMemberWithRole?: (hacker: any, role: string) => void;
}

export default function HackerSelector({
  showModal,
  setShowModal,
  isDarkMode,
  searchTerm,
  setSearchTerm,
  filteredHackers,
  title,
  selectedIds,
  showRoleSelector,
  singleSelect = false,
  handleAddMember: propHandleAddMember,
  onAddMemberWithRole,
}: HackerSelectorProps) {
  const [selectedRole, setSelectedRole] = useState(ProjectRoles[0].id);
  const { isDarkMode: themeIsDarkMode } = useTheme();

  const handleHackerSelection = (hacker: any) => {
    if (showRoleSelector && onAddMemberWithRole) {
      onAddMemberWithRole(hacker, selectedRole);
    } else if (propHandleAddMember) {
      propHandleAddMember(hacker);
    }

    if (singleSelect) {
      setShowModal(false);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`rounded-lg p-6 w-full max-w-md m-4 ${
          isDarkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            className={`text-xl font-semibold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {title}
          </h2>
          <button
            onClick={() => setShowModal(false)}
            className={`${
              isDarkMode
                ? "text-gray-400 hover:text-gray-200"
                : "text-gray-500 hover:text-gray-700"
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
          className={`w-full px-3 py-2 rounded-md mb-4 ${
            isDarkMode
              ? "bg-gray-700 text-gray-100"
              : "bg-white border border-gray-300"
          }`}
        />

        {showRoleSelector && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {ProjectRoles.map((role) => (
                <button
                  key={role.id}
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

        <div className="max-h-60 overflow-y-auto">
          {filteredHackers.map((hacker) => (
            <button
              key={hacker.id}
              onClick={() => handleHackerSelection(hacker)}
              className={`w-full text-left px-4 py-2 rounded-md flex items-center justify-between ${
                selectedIds.includes(hacker.id)
                  ? isDarkMode
                    ? "bg-gray-700 text-gray-100"
                    : "bg-indigo-50 text-indigo-900"
                  : isDarkMode
                  ? "text-gray-300 hover:bg-gray-700"
                  : "text-gray-900 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center space-x-2">
                <img
                  src={hacker.avatar?.url || "/images/default_avatar.svg"}
                  alt={hacker.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span>{hacker.name}</span>
              </div>
              {selectedIds.includes(hacker.id) && (
                <span
                  className={isDarkMode ? "text-indigo-400" : "text-indigo-600"}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowModal(false)}
            className={`px-4 py-2 rounded-md ${
              isDarkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
