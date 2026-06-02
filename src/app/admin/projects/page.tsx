"use client";

import React from "react";
import AdminAuthGate from "../AdminAuthGate";
import { ManagementBackButton } from "../../components/ManagementSurface";
import ProjectGrid from "../../components/Project";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";

export default function AdminProjectsPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, loading, userInfo } = useUserContext();

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20">
        <AdminAuthGate
          isAdmin={isAdmin}
          isAuthenticated={Boolean(userInfo)}
          loading={loading}
        >
          <div className="flex flex-col space-y-4 mb-8">
            <div>
              <ManagementBackButton />
              <h1 className="mt-4 text-3xl font-bold">Project moderation</h1>
            </div>
            <ProjectGrid show_status={true} statusFilter="ALL" showSearch={true} />
          </div>
        </AdminAuthGate>
      </div>
    </div>
  );
}
