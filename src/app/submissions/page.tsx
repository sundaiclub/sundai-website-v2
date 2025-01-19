"use client";
import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import SubmissionGrid from "../components/Submission";

export default function AllSubmissionsList() {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono`}
    >
      <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20`}>
        <div className="flex flex-col space-y-4 mb-8">
          <h1 className="text-3xl font-bold">All Submissions</h1>
          <p
            className={`text-lg ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Browse through all the amazing projects submitted by our community
          </p>
        </div>

        <SubmissionGrid showSearch={true} />
      </div>
    </div>
  );
}
