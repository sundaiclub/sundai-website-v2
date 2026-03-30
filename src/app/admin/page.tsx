"use client";
import React from "react";
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
      <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20`}>
        {isAdmin ? (
          <div className="flex flex-col space-y-4 mb-8">
            <h1 className="text-3xl font-bold">
              Full list of projects in Sundai
            </h1>
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
