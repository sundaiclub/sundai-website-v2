"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { useUserContext } from "../../contexts/UserContext";
import { useSubmission } from "../../hooks/useSubmission";
import Link from "next/link";
import Image from "next/image";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIconSolid } from "@heroicons/react/24/solid";
import type { Submission } from "@/app/components/Submission";

export default function SubmissionPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { userInfo } = useUserContext();
  const { submission, isLoading, error, handleLike } = useSubmission(
    params.submissionId as string
  );
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkEditPermissions = async () => {
      if (!submission || !userInfo) return;

      // Check if user can edit (is admin, launch lead, or participant)
      const isAdmin = userInfo?.role === "ADMIN";
      const isLaunchLead = submission.launchLead?.id === userInfo.id;
      const isParticipant = submission.participants.some(
        (p: any) => p.hackerId === userInfo.id
      );

      setCanEdit(isAdmin || isLaunchLead || isParticipant);
    };

    checkEditPermissions();
  }, [submission, userInfo]);

  if (isLoading || !submission) {
    return <div>Loading...</div>;
  }

  if (error || !submission) {
    return <div>Error loading submission</div>;
  }

  const isLiked = submission.likes.some(
    (like) => like.hackerId === userInfo?.id
  );

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } min-h-screen font-space-mono`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Add Edit Button if user can edit */}

        <div className="space-y-8">
          {/* Thumbnail Image */}
          <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
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
              priority
            />
          </div>

          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">{submission.title}</h1>
            <p className="text-xl">{submission.preview}</p>
          </div>

          {/* Links and Actions */}
          <div className="flex space-x-4">
            {submission.githubUrl && (
              <Link
                href={submission.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-800 hover:bg-gray-700"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </Link>
            )}
            {submission.demoUrl && (
              <Link
                href={submission.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-800 hover:bg-gray-700"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>Live Demo</span>
              </Link>
            )}
            <button
              onClick={() => handleLike(submission.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 hover:bg-gray-700"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {isLiked ? (
                <HeartIconSolid className="w-5 h-5 text-red-500" />
              ) : (
                <HeartIcon className="w-5 h-5" />
              )}
              <span>{submission.likes.length}</span>
            </button>
          </div>

          {/* Team */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Team</h2>
            <div className="flex flex-wrap gap-4">
              {submission.participants.map(({ hacker, role }) => (
                <div
                  key={hacker.id}
                  className={`flex items-center space-x-2 p-2 rounded-md ${
                    isDarkMode ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  {hacker.avatar && (
                    <Image
                      src={hacker.avatar.url}
                      alt={hacker.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium">{hacker.name}</div>
                    <div className="text-sm text-gray-500">{role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Description</h2>
            <div className="prose max-w-none">
              {submission.description.split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
          {canEdit && (
            <div className="mb-6">
              <Link
                href={`/submissions/${submission.id}/edit`}
                className={`inline-flex items-center px-4 py-2 rounded-md ${
                  isDarkMode
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-indigo-500 hover:bg-indigo-600"
                } text-white transition-colors duration-200`}
              >
                Edit Submission
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
