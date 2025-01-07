"use client";

import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

export default function KeyGenerator() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode } = useTheme();

  const generateToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/new-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate token");
      }

      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={generateToken}
        disabled={loading}
        className={`px-6 py-3 rounded-md ${
          isDarkMode
            ? "bg-purple-600 hover:bg-purple-700"
            : "bg-indigo-600 hover:bg-indigo-700"
        } text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center mx-auto transition-colors`}
      >
        {loading ? "Generating..." : "Generate Access Token"}
      </button>

      {error && (
        <div className="text-red-500 text-sm mt-2 text-center">{error}</div>
      )}

      {token && (
        <div className="mt-4">
          <div
            className={`text-sm font-medium mb-2 ${
              isDarkMode ? "text-gray-200" : "text-gray-900"
            }`}
          >
            Your access token:
          </div>
          <div
            className={`${
              isDarkMode ? "bg-gray-700" : "bg-gray-100"
            } p-3 rounded-md font-mono text-sm break-all mx-auto ${
              isDarkMode ? "text-gray-200" : "text-gray-900"
            }`}
          >
            {token}
          </div>
          <div
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            } mt-2`}
          >
            <p>
              Make sure to copy this token now. You won&apos;t be able to see it
              again!
            </p>
            <p className="mt-1">Use this token in the Authorization header:</p>
            <code
              className={`block ${
                isDarkMode ? "bg-gray-700" : "bg-gray-100"
              } p-2 mt-1 rounded ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}
            >
              Authorization: Bearer {token}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
