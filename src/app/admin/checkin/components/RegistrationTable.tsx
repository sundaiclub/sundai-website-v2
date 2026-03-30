"use client";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/app/contexts/ThemeContext";
import toast from "react-hot-toast";

interface Registration {
  id: string;
  email: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  emailSentAt: string | null;
}

interface Stats {
  total: number;
  checkedIn: number;
  pending: number;
  emailsSent: number;
  emailsPending: number;
}

interface RegistrationTableProps {
  selectedDate: string;
  refreshKey: number;
}

export default function RegistrationTable({
  selectedDate,
  refreshKey,
}: RegistrationTableProps) {
  const { isDarkMode } = useTheme();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    if (!selectedDate) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/checkin/registrations?eventDate=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching registrations:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations, refreshKey]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!selectedDate) return;
    const interval = setInterval(fetchRegistrations, 15000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchRegistrations]);

  async function handleResend(registrationId: string) {
    setResending(registrationId);
    try {
      const res = await fetch("/api/checkin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });

      if (res.ok) {
        toast.success("Email resent");
        fetchRegistrations();
      } else {
        toast.error("Failed to resend email");
      }
    } catch {
      toast.error("Failed to resend email");
    } finally {
      setResending(null);
    }
  }

  if (!selectedDate) {
    return (
      <div
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-white"
        } p-6 rounded-lg shadow`}
      >
        <p
          className={`text-center ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
        >
          Select a date to view registrations
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-800" : "bg-white"
      } p-6 rounded-lg shadow`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className={`text-xl font-semibold ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}
        >
          Registrations
        </h2>
        <button
          onClick={fetchRegistrations}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${
            isDarkMode
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Refresh
        </button>
      </div>

      {stats && (
        <div className="flex gap-4 mb-4 text-sm">
          <span
            className={`px-3 py-1 rounded-full ${
              isDarkMode
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Total: {stats.total}
          </span>
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Checked in: {stats.checkedIn}
          </span>
          <span
            className={`px-3 py-1 rounded-full ${
              isDarkMode
                ? "bg-yellow-900 text-yellow-100"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            Pending: {stats.pending}
          </span>
          <span
            className={`px-3 py-1 rounded-full ${
              isDarkMode
                ? "bg-blue-900 text-blue-100"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            Emails sent: {stats.emailsSent}
          </span>
        </div>
      )}

      {loading && registrations.length === 0 ? (
        <div className="flex justify-center py-8">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
              isDarkMode ? "border-purple-400" : "border-indigo-600"
            }`}
          ></div>
        </div>
      ) : registrations.length === 0 ? (
        <p
          className={`text-center py-8 ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
        >
          No registrations for this date
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={`border-b ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <th
                  className={`text-left py-2 px-3 font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Email
                </th>
                <th
                  className={`text-left py-2 px-3 font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Status
                </th>
                <th
                  className={`text-left py-2 px-3 font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Email Sent
                </th>
                <th
                  className={`text-left py-2 px-3 font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((reg) => (
                <tr
                  key={reg.id}
                  className={`border-b ${
                    isDarkMode ? "border-gray-700" : "border-gray-100"
                  }`}
                >
                  <td
                    className={`py-2 px-3 ${
                      isDarkMode ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    {reg.email}
                  </td>
                  <td className="py-2 px-3">
                    {reg.checkedIn ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Checked In
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          isDarkMode
                            ? "bg-yellow-900 text-yellow-100"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {reg.emailSentAt ? (
                      <span
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {new Date(reg.emailSentAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-red-500">Not sent</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => handleResend(reg.id)}
                      disabled={resending === reg.id}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        resending === reg.id
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : isDarkMode
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {resending === reg.id ? "Sending..." : "Resend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
