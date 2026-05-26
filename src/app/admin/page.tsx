"use client";

import Link from "next/link";
import AdminAuthGate from "./AdminAuthGate";
import { useTheme } from "../contexts/ThemeContext";
import { useUserContext } from "../contexts/UserContext";

const adminSections = [
  { href: "/admin/projects", label: "Project moderation" },
  { href: "/admin/chapters", label: "Chapters" },
  { href: "/admin/application-templates", label: "Application templates" },
  { href: "/admin/bans", label: "Global moderation" },
  { href: "/organizer/events", label: "Organizer events" },
];

export default function AdminConsolePage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, loading } = useUserContext();

  return (
    <main
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-6xl mx-auto px-4 py-20">
        <AdminAuthGate isAdmin={isAdmin} loading={loading}>
          <>
            <h1 className="text-3xl font-bold mb-8">Site admin console</h1>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminSections.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  className={`border rounded-lg p-4 transition-colors ${
                    isDarkMode
                      ? "border-gray-700 hover:bg-gray-800"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-semibold">{section.label}</span>
                </Link>
              ))}
            </div>
          </>
        </AdminAuthGate>
      </div>
    </main>
  );
}
