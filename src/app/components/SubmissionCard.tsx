"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import type { Submission } from "./Submission";

const statusOptions = ["DRAFT", "PENDING", "APPROVED"];

export default function SubmissionCard({
  submission,
  userInfo,
  handleLike,
  isDarkMode,
  show_status,
  show_team = true,
  onStatusChange,
  onStarredChange,
  isAdmin,
}: {
  submission: Submission;
  userInfo: any;
  handleLike: (submissionId: string) => void;
  isDarkMode: boolean;
  show_status: boolean;
  show_team?: boolean;
  onStatusChange?: (submissionId: string, newStatus: string) => void;
  onStarredChange?: (submissionId: string, isStarred: boolean) => void;
  isAdmin?: boolean;
}) {
  const isLiked = submission.likes.some(
    (like) => like.hackerId === userInfo?.id
  );

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-800" : "bg-white"
      } rounded-lg shadow-lg overflow-hidden relative`}
    >
      <Link href={`/submissions/${submission.id}`}>
        <div className="relative h-48">
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
          />
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start">
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-gray-100" : "text-gray-900"
              }`}
            >
              {submission.title}
            </h3>
          </div>
          <p
            className={`mt-2 text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {submission.preview}
          </p>

          <div className="mt-4 flex space-x-3">
            {submission.githubUrl && (
              <a
                href={submission.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center space-x-1 text-sm ${
                  isDarkMode
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </a>
            )}
            {submission.demoUrl && (
              <a
                href={submission.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center space-x-1 text-sm ${
                  isDarkMode
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <GlobeAltIcon className="w-4 h-4" />
                <span>Demo</span>
              </a>
            )}
          </div>

          {show_team && (
            <div className="mt-4">
              <div className="flex -space-x-2">
                {[
                  submission.launchLead,
                  ...submission.participants.map((p) => p.hacker),
                ].map((member, index) => (
                  <div
                    key={member.id}
                    className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-gray-800"
                  >
                    <Image
                      src={member.avatar?.url || "/images/default_avatar.svg"}
                      alt={member.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Link>
      <div className="absolute top-2 right-2 flex gap-2">
        {show_status && isAdmin && (
          <Listbox
            value={submission.status}
            onChange={(newStatus) => onStatusChange?.(submission.id, newStatus)}
          >
            <div className="relative">
              <Listbox.Button
                className={`relative w-32 py-1 pl-3 pr-10 text-left rounded-lg cursor-default ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-200"
                    : "bg-white text-gray-900"
                }`}
              >
                <span className="block truncate">{submission.status}</span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="w-5 h-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Listbox.Options
                  className={`absolute w-full py-1 mt-1 overflow-auto text-base rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-200"
                      : "bg-white text-gray-900"
                  }`}
                >
                  {statusOptions.map((status) => (
                    <Listbox.Option
                      key={status}
                      value={status}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active
                            ? isDarkMode
                              ? "bg-gray-600"
                              : "bg-indigo-100"
                            : ""
                        }`
                      }
                    >
                      {status}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        )}
        {submission.is_starred && (
          <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium">
            Featured
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          handleLike(submission.id);
        }}
        className={`absolute bottom-2 right-2 p-2 rounded-full ${
          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
        }`}
      >
        {isLiked ? (
          <HeartIconSolid className="w-6 h-6 text-red-500" />
        ) : (
          <HeartIcon
            className={`w-6 h-6 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          />
        )}
      </button>
    </div>
  );
}
