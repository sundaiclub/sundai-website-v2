"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import type { Submission } from "./Submission";

type SubmissionSearchProps = {
  submissions: Submission[];
  onFilteredSubmissionsChange: (filtered: Submission[]) => void;
};

export default function SubmissionSearch({
  submissions,
  onFilteredSubmissionsChange,
}: SubmissionSearchProps) {
  const { isDarkMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTechTags, setSelectedTechTags] = useState<string[]>([]);
  const [selectedDomainTags, setSelectedDomainTags] = useState<string[]>([]);

  // Get unique tags from all submissions with null checks
  const allTechTags = Array.from(
    new Set(
      submissions?.flatMap((s) => s.techTags?.map((tag) => tag.name) || []) ||
        []
    )
  );

  const allDomainTags = Array.from(
    new Set(
      submissions?.flatMap((s) => s.domainTags?.map((tag) => tag.name) || []) ||
        []
    )
  );

  useEffect(() => {
    if (!submissions) return;

    const filtered = submissions.filter((submission) => {
      const matchesSearch =
        submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.preview.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTechTags =
        selectedTechTags.length === 0 ||
        selectedTechTags.every((tag) =>
          submission.techTags?.some((t) => t.name === tag)
        );

      const matchesDomainTags =
        selectedDomainTags.length === 0 ||
        selectedDomainTags.every((tag) =>
          submission.domainTags?.some((t) => t.name === tag)
        );

      return matchesSearch && matchesTechTags && matchesDomainTags;
    });

    onFilteredSubmissionsChange(filtered);
  }, [searchTerm, selectedTechTags, selectedDomainTags, submissions]);

  return (
    <div className="mb-8 space-y-4">
      {/* Search input */}
      <input
        type="text"
        placeholder="Search submissions..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`w-full px-4 py-2 rounded-lg ${
          isDarkMode
            ? "bg-gray-800 text-gray-100 placeholder-gray-400"
            : "bg-white text-gray-900 placeholder-gray-500"
        } border ${
          isDarkMode ? "border-gray-700" : "border-gray-300"
        } focus:outline-none focus:ring-2 ${
          isDarkMode ? "focus:ring-purple-500" : "focus:ring-indigo-500"
        }`}
      />

      {/* Tag filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label
            className={`block text-sm font-medium mb-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Tech Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {allTechTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTechTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedTechTags.includes(tag)
                    ? isDarkMode
                      ? "bg-purple-600 text-white"
                      : "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <label
            className={`block text-sm font-medium mb-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Domain Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {allDomainTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedDomainTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedDomainTags.includes(tag)
                    ? isDarkMode
                      ? "bg-purple-600 text-white"
                      : "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
