"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { format } from "date-fns";

type AttendanceRecord = {
  id: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number | null;
  location: string;
  verified: boolean;
  hacker: {
    name: string;
    avatar: { url: string } | null;
    totalMinutesAttended: number;
  };
  verifiedBy?: {
    name: string;
  } | null;
};

export default function AttendanceTable() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    endDate: new Date(),
  });

  useEffect(() => {
    fetchAttendance();
  }, [dateRange]);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(
        `/api/attendance?startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`
      );
      const data = await response.json();
      setAttendance(data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="spinner-small"></div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <h3 className="section-title">Attendance Records</h3>
        <div className="flex space-x-4">
          <input
            type="date"
            value={dateRange.startDate.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                startDate: new Date(e.target.value),
              }))
            }
            className="form-input"
          />
          <input
            type="date"
            value={dateRange.endDate.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                endDate: new Date(e.target.value),
              }))
            }
            className="form-input"
          />
        </div>
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hacker</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attendance.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="avatar-large">
                      {record.hacker.avatar ? (
                        <Image
                          src={record.hacker.avatar.url}
                          alt={record.hacker.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          <span className="text-indigo-600 font-medium">
                            {record.hacker.name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {record.hacker.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Total: {Math.floor(record.hacker.totalMinutesAttended / 60)}h{" "}
                        {record.hacker.totalMinutesAttended % 60}m
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(record.date), "MMM d, yyyy")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(record.checkInTime), "h:mm a")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.checkOutTime
                    ? format(new Date(record.checkOutTime), "h:mm a")
                    : "Active"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.duration
                    ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m`
                    : "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`badge ${
                      record.verified ? "status-badge-approved" : "badge-pending"
                    }`}
                  >
                    {record.verified ? "Verified" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}