"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../contexts/ThemeContext";
import { useUserContext } from "../contexts/UserContext";
import ThemeToggle from "./ThemeToggle";
import { UserButton } from "@clerk/nextjs";

export default function Navigation() {
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const { isAdmin } = useUserContext();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/submissions", label: "All Submissions" },
    { href: "/weeks", label: "Weekly Showcase" },
    { href: "/submissions/new", label: "Submit Project" },
  ];

  if (isAdmin) {
    navLinks.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav
      className={`sticky top-0 z-50 ${
        isDarkMode ? "bg-gray-900" : "bg-white"
      } border-b ${
        isDarkMode ? "border-gray-800" : "border-gray-200"
      } font-space-mono`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold">
                Sundai
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 ${
                    pathname === link.href
                      ? isDarkMode
                        ? "border-purple-400 text-purple-400"
                        : "border-indigo-500 text-indigo-600"
                      : isDarkMode
                      ? "text-gray-300 hover:text-gray-100"
                      : "text-gray-500 hover:text-gray-700"
                  } ${
                    pathname === link.href ? "border-b-2" : ""
                  } text-sm font-medium`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    </nav>
  );
}
