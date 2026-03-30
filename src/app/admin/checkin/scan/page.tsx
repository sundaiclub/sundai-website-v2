"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useUserContext } from "@/app/contexts/UserContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import CheckInResult from "../components/CheckInResult";

// Dynamically import QRScanner to avoid SSR issues with html5-qrcode
const QRScanner = dynamic(() => import("../components/QRScanner"), {
  ssr: false,
});

type VerifyResult = {
  status: "success" | "already_checked_in" | "not_found";
  email?: string;
  checkedInAt?: string;
};

export default function ScanPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, loading } = useUserContext();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || "";

  const [result, setResult] = useState<VerifyResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    checkedIn: number;
  } | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!date) return;
    try {
      const res = await fetch(
        `/api/checkin/registrations?eventDate=${date}`
      );
      if (res.ok) {
        const data = await res.json();
        setStats({
          total: data.stats.total,
          checkedIn: data.stats.checkedIn,
        });
      }
    } catch {
      // Stats are non-critical, silently ignore
    }
  }, [date]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function verifyToken(token: string) {
    if (verifying) return;
    setVerifying(true);
    setPaused(true);

    try {
      const res = await fetch("/api/checkin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      setResult(data);

      // Vibrate on success
      if (data.status === "success" && navigator.vibrate) {
        navigator.vibrate(200);
      }

      fetchStats();
    } catch {
      setResult({ status: "not_found" });
    } finally {
      setVerifying(false);
    }
  }

  function handleScan(decodedText: string) {
    // Extract token from URL or use raw text
    try {
      const url = new URL(decodedText);
      const token = url.searchParams.get("token");
      if (token) {
        verifyToken(token);
        return;
      }
    } catch {
      // Not a URL, try using as raw token
    }
    verifyToken(decodedText);
  }

  function handleDismissResult() {
    setResult(null);
    setPaused(false);
  }

  async function handleManualVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await verifyToken(manualToken.trim());
    setManualToken("");
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

  if (!isAdmin) {
    return (
      <div
        className={`flex justify-center items-center min-h-screen ${
          isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
        } font-space-mono`}
      >
        <div className="text-center text-red-500">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-lg mx-auto px-4 py-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">QR Scanner</h1>
          <Link
            href={`/admin/checkin${date ? `?date=${date}` : ""}`}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              isDarkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Back
          </Link>
        </div>

        {date && (
          <p
            className={`text-sm mb-4 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Scanning for:{" "}
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        {stats && (
          <div
            className={`text-center py-3 px-4 rounded-lg mb-4 ${
              isDarkMode ? "bg-gray-800" : "bg-gray-50"
            }`}
          >
            <span className="text-2xl font-bold">{stats.checkedIn}</span>
            <span
              className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {" "}
              / {stats.total} checked in
            </span>
          </div>
        )}

        <div className="mb-4 rounded-lg overflow-hidden">
          <QRScanner onScan={handleScan} paused={paused} />
        </div>

        <CheckInResult
          status={result?.status || null}
          email={result?.email}
          checkedInAt={result?.checkedInAt}
          onDismiss={handleDismissResult}
        />

        {/* Manual token entry */}
        <div className="mt-6">
          <p
            className={`text-xs mb-2 ${
              isDarkMode ? "text-gray-500" : "text-gray-400"
            }`}
          >
            Or enter token manually:
          </p>
          <form onSubmit={handleManualVerify} className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste token here"
              className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            <button
              type="submit"
              disabled={verifying}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                verifying
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              Verify
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
