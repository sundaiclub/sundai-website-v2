"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "../contexts/ThemeContext";

interface UserStats {
  uid: string;
  total_hits: number;
  last_hit_time: string | null;
  tokens_used_today: number;
}

export default function StatsPage() {
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getToken();
        const response = await fetch("/api/stats", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [getToken]);

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
            Monitor your API usage
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
                Total API Hits
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats?.total_hits.toLocaleString()}
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
                {stats?.tokens_used_today.toLocaleString()}
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
                Last API Hit
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats?.last_hit_time
                  ? new Date(stats.last_hit_time).toLocaleString()
                  : "Never"}
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
                User ID
              </div>
              <div
                className={`text-lg font-bold mt-2 break-all ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {stats?.uid}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
