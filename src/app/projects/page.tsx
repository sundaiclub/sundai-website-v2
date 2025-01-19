"use client";
import SubmissionGrid from "../components/Submission";
import { useTheme } from "../contexts/ThemeContext";

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
          <h1 className="text-3xl font-bold">
            Full list of submissions in Sundai
          </h1>
        </div>

        <SubmissionGrid showSearch={true} />
      </div>
    </div>
  );
}
