"use client";
import { useState, useEffect } from "react";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import Image from "next/image";
import Link from "next/link";

type AttendanceRecord = {
  id: string;
  status: "PRESENT" | "LATE" | "ABSENT";
  timestamp: string;
  hacker: {
    id: string;
    name: string;
    avatar?: { url: string } | null;
  };
};

type Week = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  theme?: string;
  attendance: AttendanceRecord[];
};

export default function AttendancePage() {
  const { isAdmin, userInfo } = useUserContext();
  const { isDarkMode } = useTheme();
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    fetchCurrentWeek();
  }, []);

  const fetchCurrentWeek = async () => {
    try {
      const response = await fetch("/api/weeks/current");
      if (response.ok) {
        const data = await response.json();
        setCurrentWeek(data);
        // Check if user is already checked in
        if (userInfo) {
          setCheckedIn(
            data.attendance.some(
              (a: AttendanceRecord) => a.hacker.id === userInfo.id
            )
          );
        }
      }
    } catch (error) {
      console.error("Error fetching current week:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setCheckedIn(true);
        fetchCurrentWeek(); // Refresh attendance list
      } else {
        const error = await response.json();
        alert(error.message || "Failed to check in");
      }
    } catch (error) {
      console.error("Error checking in:", error);
      alert("Failed to check in");
    }
  };

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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1
        className={`text-3xl font-bold mb-8 ${
          isDarkMode ? "text-gray-100" : "text-gray-900"
        }`}
      >
        Week {currentWeek?.number} Attendance
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Check-in Section */}
        <div
          className={`${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } p-6 rounded-lg shadow`}
        >
          <h2
            className={`text-xl font-semibold mb-4 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            Check In
          </h2>
          {checkedIn ? (
            <div
              className={`${
                isDarkMode
                  ? "bg-green-900 text-green-100"
                  : "bg-green-100 text-green-800"
              } p-4 rounded-lg`}
            >
              You&apos;re checked in for this week!
            </div>
          ) : (
            <button
              onClick={handleCheckIn}
              className={`w-full py-3 px-4 ${
                isDarkMode
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-indigo-500 hover:bg-indigo-600"
              } text-white rounded-lg transition-colors`}
            >
              Check In for Week {currentWeek?.number}
            </button>
          )}
        </div>

        {/* Attendance List */}
        <div
          className={`${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } p-6 rounded-lg shadow`}
        >
          <h2
            className={`text-xl font-semibold mb-4 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            Attendance List
          </h2>
          <div className="space-y-4">
            {currentWeek?.attendance.map((record) => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-3 ${
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
                        className={`w-full h-full ${
                          isDarkMode ? "bg-gray-600" : "bg-gray-200"
                        } rounded-full flex items-center justify-center`}
                      >
                        <span
                          className={`${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          } text-lg`}
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
            {(!currentWeek?.attendance ||
              currentWeek.attendance.length === 0) && (
              <p
                className={`text-center py-4 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                No attendance records yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
