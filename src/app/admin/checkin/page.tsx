"use client";
import { useState } from "react";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useUserContext } from "@/app/contexts/UserContext";
import Link from "next/link";
import DateSelector from "./components/DateSelector";
import CSVUploadForm from "./components/CSVUploadForm";
import RegistrationTable from "./components/RegistrationTable";

export default function CheckInPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, loading } = useUserContext();
  const [selectedDate, setSelectedDate] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

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
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Event Check-In</h1>
            {selectedDate && (
              <Link
                href={`/admin/checkin/scan?date=${selectedDate}`}
                className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Open Scanner
              </Link>
            )}
          </div>

          <DateSelector value={selectedDate} onChange={setSelectedDate} />

          {selectedDate && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CSVUploadForm
                selectedDate={selectedDate}
                onUploadComplete={() => setRefreshKey((k) => k + 1)}
              />
              <RegistrationTable
                selectedDate={selectedDate}
                refreshKey={refreshKey}
              />
            </div>
          )}

          {!selectedDate && (
            <div
              className={`text-center py-16 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Select a date to get started
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
