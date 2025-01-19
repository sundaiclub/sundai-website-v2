"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import SubmissionSearch from "./SubmissionSearch";
import SubmissionCard from "./SubmissionCard";

export type Submission = {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING" | "APPROVED";
  preview: string;
  description: string;
  githubUrl?: string | null;
  demoUrl?: string | null;
  blogUrl?: string | null;
  techTags: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  domainTags: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  is_starred: boolean;
  is_broken: boolean;
  thumbnail?: {
    url: string;
  } | null;
  launchLead: {
    id: string;
    name: string;
    avatar?: {
      url: string;
    } | null;
  };
  participants: Array<{
    role: string;
    hacker: {
      id: string;
      name: string;
      bio?: string | null;
      avatar?: {
        url: string;
      } | null;
    };
  }>;
  likes: Array<{
    hackerId: string;
    createdAt: string;
  }>;
};

export default function SubmissionGrid({
  showStarredOnly = false,
  show_status = false,
  show_team = true,
  showSearch = false,
}: {
  showStarredOnly?: boolean;
  show_status?: boolean;
  show_team?: boolean;
  showSearch?: boolean;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const { userInfo, isAdmin } = useUserContext();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await fetch("/api/submissions");
        if (response.ok) {
          const data = await response.json();
          setSubmissions(data);
          setFilteredSubmissions(data);
        }
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  const handleLike = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/like`, {
        method: "POST",
      });
      // ... rest of the handler
    } catch (error) {
      console.error("Error liking submission:", error);
    }
  };

  const handleStatusChange = async (
    submissionId: string,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, status: newStatus } : s
        )
      );
      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Error updating submission status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleStarredChange = async (
    submissionId: string,
    isStarred: boolean
  ) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/star`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_starred: isStarred }),
      });

      if (!response.ok) {
        throw new Error("Failed to update starred status");
      }

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, is_starred: isStarred } : s
        )
      );
      setFilteredSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, is_starred: isStarred } : s
        )
      );
      toast.success(
        isStarred
          ? "Added to featured projects"
          : "Removed from featured projects"
      );
    } catch (error) {
      console.error("Error updating starred status:", error);
      toast.error("Failed to update featured status");
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

  const displaySubmissions = showStarredOnly
    ? filteredSubmissions.filter((submission) => submission.is_starred)
    : filteredSubmissions;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-12">
      {showSearch && (
        <SubmissionSearch
          submissions={submissions}
          onFilteredSubmissionsChange={setFilteredSubmissions}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {displaySubmissions.map((submission) => (
          <Link
            key={submission.id}
            href={`/submissions/${submission.id}`}
            className={`block overflow-hidden rounded-lg transition-transform duration-200 hover:-translate-y-1 ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            } shadow-lg`}
          >
            <div className="relative h-48 w-full">
              <Image
                src={
                  submission.thumbnail?.url ||
                  (isDarkMode
                    ? "/images/default_submission_thumbnail_dark.svg"
                    : "/images/default_submission_thumbnail_light.svg")
                }
                alt={submission.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <div className="p-4">
              <h3
                className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {submission.title}
              </h3>
              <p
                className={`text-sm mb-4 ${
                  isDarkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {submission.preview}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Image
                    src={
                      submission.launchLead.avatar?.url ||
                      "/images/default_avatar.svg"
                    }
                    alt={submission.launchLead.name}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {submission.launchLead.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <HeartIcon
                    className={`w-5 h-5 ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {submission.likes.length}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
