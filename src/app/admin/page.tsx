"use client";
import React from "react";
import Link from "next/link";
import ProjectGrid from "../components/Project";
import { useTheme } from "../contexts/ThemeContext";
import { useUserContext } from "../contexts/UserContext";

export default function AllProjectsList() {
  const { isDarkMode } = useTheme();
  const { isAdmin, userInfo } = useUserContext();

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono`}
    >
      <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-24 pb-20`}>
        {isAdmin ? (
          <div className="flex flex-col space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">
                Full list of projects in Sundai
              </h1>
              <Link
                href="/admin/checkin"
                className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Event Check-In
              </Link>
            </div>
            <ProjectGrid show_status={true} statusFilter="ALL" showSearch={true}/>
          </div>
        ) : (
          <div className="text-center text-red-500">
            You do not have permission to view this page.
          </div>
        )}
      </div>
    </div>
  );
}
