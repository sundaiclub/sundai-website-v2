"use client";

import { useState } from "react";

export default function KeyGenerator() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed mx-auto block"
      >
        {loading ? "Generating..." : "Generate Access Token"}
      </button>

      {error && (
        <div className="text-red-500 text-sm mt-2 text-center">{error}</div>
      )}

      {token && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2 text-black">
            Your access token:
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md font-mono text-sm break-all mx-auto text-black">
            {token}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            <p>
              Make sure to copy this token now. You won&apos;t be able to see it
              again!
            </p>
            <p className="mt-1">Use this token in the Authorization header:</p>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 mt-1 rounded text-black">
              Authorization: Bearer {token}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
