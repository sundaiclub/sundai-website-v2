"use client";
import { useState, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import Image from "next/image";
import Link from "next/link";

type Week = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  theme?: string;
  attendance: Array<{
    id: string;
    status: "PRESENT" | "LATE" | "ABSENT";
    timestamp: string;
    hacker: {
      id: string;
      name: string;
      avatar?: { url: string } | null;
      role: string;
    };
  }>;
  submissions: Array<{
    id: string;
    title: string;
    status: "DRAFT" | "PENDING" | "APPROVED";
    preview: string;
    description: string;
    githubUrl?: string | null;
    demoUrl?: string | null;
    blogUrl?: string | null;
    techTags: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>;
    domainTags: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>;
    is_starred: boolean;
    is_broken: boolean;
    thumbnail?: {
      url: string;
    } | null;
    launchLead: {
      name: string;
      avatar?: { url: string } | null;
    };
  }>;
};

export default function WeeksPage() {
  const { isAdmin } = useUserContext();
  const { isDarkMode } = useTheme();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const response = await fetch("/api/weeks");
        if (response.ok) {
          const data = await response.json();
          setWeeks(data);
        }
      } catch (error) {
        console.error("Error fetching weeks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeks();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
            isDarkMode ? "border-purple-400" : "border-indigo-600"
          }`}
        ></div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen py-20 ${
        isDarkMode ? "bg-gray-900" : "bg-[#E5E5E5]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <h1
          className={`text-3xl font-bold mb-8 ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}
        >
          Weekly Attendance
        </h1>

        <div className="space-y-8">
          {weeks.map((week) => (
            <div
              key={week.id}
              className={`${
                isDarkMode ? "bg-gray-800" : "bg-white"
              } rounded-lg shadow-lg p-6`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2
                    className={`text-2xl font-bold mb-2 ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Week {week.number}
                  </h2>
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {new Date(week.startDate).toLocaleDateString()} -{" "}
                    {new Date(week.endDate).toLocaleDateString()}
                  </p>
                  {week.theme && (
                    <p
                      className={`mt-1 text-sm ${
                        isDarkMode ? "text-purple-400" : "text-indigo-600"
                      }`}
                    >
                      {week.theme}
                    </p>
                  )}
                </div>
                <div
                  className={`px-4 py-2 rounded-full ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-100"
                  }`}
                >
                  <span
                    className={`${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {week.attendance.length} Attendees
                  </span>
                </div>
              </div>

              {/* Attendance List */}
              <div className="space-y-4">
                {week.attendance.map((record) => (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-4 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-50"
                    } rounded-lg`}
                  >
                    <div className="flex items-center">
                      <div className="relative w-10 h-10">
                        {record.hacker.avatar ? (
                          <Image
                            src={record.hacker.avatar.url}
                            alt={record.hacker.name}
                            fill
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full rounded-full flex items-center justify-center ${
                              isDarkMode ? "bg-gray-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={
                                isDarkMode ? "text-gray-300" : "text-gray-600"
                              }
                            >
                              {record.hacker.name[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <Link href={`/hacker/${record.hacker.id}`}>
                          <p
                            className={`font-medium ${
                              isDarkMode ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {record.hacker.name}
                          </p>
                        </Link>
                        <p
                          className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        record.status === "PRESENT"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          : record.status === "LATE"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Submissions Section */}
              {week.submissions.length > 0 && (
                <div className="mt-6">
                  <h3
                    className={`text-lg font-semibold mb-4 ${
                      isDarkMode ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    All Submissions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {week.submissions
                      .sort((a, b) =>
                        a.is_starred === b.is_starred
                          ? 0
                          : a.is_starred
                          ? -1
                          : 1
                      )
                      .map((submission) => (
                        <Link
                          key={submission.id}
                          href={`/submissions/${submission.id}`}
                          className={`${
                            isDarkMode ? "bg-gray-700" : "bg-gray-50"
                          } rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
                            submission.is_starred
                              ? "ring-2 ring-yellow-400"
                              : ""
                          }`}
                        >
                          <div className="relative h-32">
                            <Image
                              src={
                                submission.thumbnail?.url ||
                                (isDarkMode
                                  ? "/images/default_submission_thumbnail_dark.svg"
                                  : "/images/default_submission_thumbnail_light.svg")
                              }
                              alt={submission.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="p-4">
                            <h4
                              className={`font-medium ${
                                isDarkMode ? "text-gray-100" : "text-gray-900"
                              }`}
                            >
                              {submission.title}
                            </h4>
                            <p
                              className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              by {submission.launchLead.name}
                            </p>
                          </div>
                          {submission.is_starred && (
                            <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium">
                              Featured
                            </div>
                          )}
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
