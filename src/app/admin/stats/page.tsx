/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";

interface UserStats {
  uid: string;
  total_hits: number;
  last_hit_time: string | null;
  tokens_used_today: number;
}

export default function AdminStatsPage() {
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  const { isAdmin } = useUserContext();
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getToken();
        const response = await fetch("/api/total-stats", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setStats(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [getToken]);

  if (!isAdmin) {
    return (
      <div
        className={`min-h-screen py-12 px-4 ${
          isDarkMode
            ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
            : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
        }`}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
          <p className="mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

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
      className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1
            className={`text-3xl font-extrabold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            API Usage Statistics
          </h1>
          <p
            className={`mt-2 text-lg ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Monitor API usage across all users
          </p>
        </div>

        {error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
            <div
              className={`${
                isDarkMode ? "bg-gray-800/50" : "bg-white"
              } rounded-lg shadow-lg p-6`}
            >
              <div
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total Users
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats.length}
              </div>
            </div>

            <div
              className={`${
                isDarkMode ? "bg-gray-800/50" : "bg-white"
              } rounded-lg shadow-lg p-6`}
            >
              <div
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total API Hits
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats
                  .reduce((sum, user) => sum + user.total_hits, 0)
                  .toLocaleString()}
              </div>
            </div>

            <div
              className={`${
                isDarkMode ? "bg-gray-800/50" : "bg-white"
              } rounded-lg shadow-lg p-6`}
            >
              <div
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Tokens Used Today
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats
                  .reduce((sum, user) => sum + user.tokens_used_today, 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div
          className={`${
            isDarkMode ? "bg-gray-800/50" : "bg-white"
          } shadow-lg rounded-lg overflow-hidden`}
        >
          <div className="p-6">
            <h2
              className={`text-xl font-semibold mb-4 ${
                isDarkMode ? "text-gray-100" : "text-gray-900"
              }`}
            >
              User Details
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      User ID
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Total Hits
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Tokens Today
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Last Used
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y divide-gray-200 dark:divide-gray-700`}
                >
                  {stats.map((user, idx) => (
                    <tr
                      key={user.uid}
                      className={
                        idx % 2 === 0
                          ? isDarkMode
                            ? "bg-gray-800/30"
                            : "bg-gray-50"
                          : ""
                      }
                    >
                      <td
                        className={`px-6 py-4 text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-900"
                        }`}
                      >
                        {user.uid}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-900"
                        }`}
                      >
                        {user.total_hits.toLocaleString()}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-900"
                        }`}
                      >
                        {user.tokens_used_today.toLocaleString()}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-900"
                        }`}
                      >
                        {user.last_hit_time
                          ? new Date(user.last_hit_time).toLocaleString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
