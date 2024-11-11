"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";

type Project = {
  id: string;
  title: string;
  status: string;
  preview: string;
  description: string;
  githubUrl?: string | null;
  demoUrl?: string | null;
  blogUrl?: string | null;
  techTags: Array<{
    id: string;
    name: string;
    description? : string | null;
  }>;
  domainTags: Array<{
    id: string;
    name: string;
    description? : string | null;
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
      avatar?: {
        url: string;
      } | null;
    };
  }>;
  startDate: Date;
  endDate?: Date | null;
  likes: Array<{
    hackerId: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

function ProjectCard({ project, userInfo, handleLike, isDarkMode, show_status }: {
  project: Project;
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
  show_status: boolean;
}) {
  return (
    <div
      key={project.id}
      className={`${
        isDarkMode
          ? "bg-gray-800 hover:shadow-purple-400/20"
          : "bg-white hover:shadow-xl"
      } rounded-lg shadow-lg overflow-hidden transition-shadow relative`}
    >
      <div className="relative h-40 sm:h-48">
        <Link href={`/projects/${project.id}`}>
          <Image
            src={
              project.thumbnail?.url ||
              "/images/projects_screenshots/week-25.jpg"
            }
            alt={project.title}
            fill
            className="object-cover"
            unoptimized
          />
        </Link>
        {show_status && (
          <div className="absolute top-2 right-2 flex space-x-2">
            <div
              className={`px-2 py-1 rounded-full text-xs ${
                project.is_starred
                  ? "bg-yellow-300 text-yellow-800"
                  : "bg-gray-300 text-gray-800"
              }`}
            >
              {project.is_starred ? "Starred" : "Not Starred"}
            </div>
            <div
              className={`px-2 py-1 rounded-full text-xs ${
                project.status === "DRAFT"
                  ? "bg-gray-300 text-gray-800"
                  : project.status === "PENDING"
                  ? "bg-orange-300 text-orange-800"
                  : project.status === "APPROVED"
                  ? "bg-green-300 text-green-800"
                  : isDarkMode
                  ? "bg-purple-900 text-purple-300"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {project.status}
            </div>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Link href={`/projects/${project.id}`}>
              <h3
                className={`text-lg sm:text-xl font-bold ${
                  isDarkMode
                    ? "text-gray-100 hover:text-purple-400"
                    : "text-gray-900 hover:text-indigo-600"
                } transition-colors`}
              >
                {project.title}
              </h3>
            </Link>
            <p
              className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              } mt-1`}
            >
              Created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                handleLike(
                  e,
                  project.id,
                  project.likes.some(
                    (like) => like.hackerId === userInfo?.id
                  )
                );
              }}
              className="p-2 -m-2 flex items-center space-x-1 text-gray-600 hover:text-indigo-600 transition-colors active:scale-95 touch-manipulation"
              aria-label={`Like project ${project.title}`}
            >
              <div className="relative">
                {project.likes.some(
                  (like) => like.hackerId === userInfo?.id
                ) ? (
                  <HeartIconSolid className="h-7 w-7 text-indigo-600" />
                ) : (
                  <HeartIcon className="h-7 w-7" />
                )}
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-sm">
                  {project.likes.length}
                </span>
              </div>
            </button>
          </div>
        </div>

        <Link href={`/projects/${project.id}`}>
          <p
            className={`text-sm sm:text-base ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } mb-4`}
          >
            {project.preview}
          </p>
        </Link>

        {/* Tags Section */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.techTags.map((tag) => (
            <span
              key={tag.id}
              className={`px-2 py-1 rounded-full text-xs ${
                isDarkMode
                  ? "bg-purple-900/50 text-purple-300"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {tag.name}
            </span>
          ))}
          {project.domainTags.map((tag) => (
            <span
              key={tag.id}
              className={`px-2 py-1 rounded-full text-xs ${
                isDarkMode
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {tag.name}
            </span>
          ))}
        </div>

        {/* Team Section */}
        <div className="mb-4">
          <h4
            className={`text-xs sm:text-sm font-semibold ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            } mb-2`}
          >
            Team
          </h4>
          <div className="space-y-2">
            {/* Launch Lead */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {project.launchLead.avatar ? (
                  <Image
                    src={project.launchLead.avatar.url}
                    alt={project.launchLead.name}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 ${
                      isDarkMode ? "bg-purple-900" : "bg-indigo-100"
                    } rounded-full flex items-center justify-center`}
                  >
                    <span
                      className={`${
                        isDarkMode ? "text-purple-400" : "text-indigo-600"
                      } text-xs`}
                    >
                      {project.launchLead.name[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-2 sm:ml-3">
                <Link href={`/hacker/${project.launchLead.id}`}>
                  <p
                    className={`text-xs sm:text-sm font-medium ${
                      isDarkMode
                        ? "text-gray-200 hover:text-purple-400"
                        : "text-gray-900 hover:text-indigo-600"
                    } transition-colors`}
                  >
                    {project.launchLead.name}
                  </p>
                </Link>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-purple-400" : "text-indigo-600"
                  }`}
                >
                  Launch Lead
                </p>
              </div>
            </div>

            {/* Other Participants */}
            {project.participants.map((participant) => (
              <div
                key={participant.hacker.id}
                className="flex items-center"
              >
                <div className="flex-shrink-0">
                  {participant.hacker.avatar ? (
                    <Image
                      src={participant.hacker.avatar.url}
                      alt={participant.hacker.name}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div
                      className={`w-7 h-7 ${
                        isDarkMode ? "bg-gray-700" : "bg-gray-100"
                      } rounded-full flex items-center justify-center`}
                    >
                      <span
                        className={`${
                          isDarkMode ? "text-gray-300" : "text-gray-600"
                        } text-xs`}
                      >
                        {participant.hacker.name[0]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="ml-2 sm:ml-3">
                  <Link href={`/hacker/${participant.hacker.id}`}>
                    <p
                      className={`text-xs sm:text-sm font-medium ${
                        isDarkMode
                          ? "text-gray-200 hover:text-purple-400"
                          : "text-gray-900 hover:text-indigo-600"
                      } transition-colors`}
                    >
                      {participant.hacker.name}
                    </p>
                  </Link>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {participant.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="flex space-x-4 mt-4 pt-4 border-t border-gray-200">
          {project.demoUrl && (
            <Link
              href={project.demoUrl}
              className={`${
                isDarkMode
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-indigo-600 hover:text-indigo-800"
              } text-xs sm:text-sm font-medium`}
              target="_blank"
            >
              View Demo →
            </Link>
          )}
          {project.githubUrl && (
            <Link
              href={project.githubUrl}
              className={`${
                isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
              } text-xs sm:text-sm font-medium`}
              target="_blank"
            >
              GitHub →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectGrid({ showStarredOnly = false, statusFilter="APPROVED", show_status = false}) {
  const { user } = useUser();
  const { isAdmin, userInfo } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    async function fetchProjects() {
      try {
        const queryParam = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
        const response = await fetch(`/api/projects${queryParam}`);
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [statusFilter]);

  const handleLike = async (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => {
    e.preventDefault(); // Prevent navigation
    if (!user) {
      alert("Please sign in to like projects");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/like`, {
        method: isLiked ? "DELETE" : "POST",
      });

      if (response.ok) {
        setProjects(
          projects.map((project) => {
            if (project.id === projectId) {
              return {
                ...project,
                likes: isLiked
                  ? project.likes.filter(
                      (like) => like.hackerId !== userInfo?.id
                    )
                  : [
                      ...project.likes,
                      {
                        hackerId: userInfo.id,
                        createdAt: new Date().toISOString(),
                      },
                    ],
              };
            }
            return project;
          })
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleMoveToPending = async (projectId: string) => {
    if (!isAdmin) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "PENDING" }),
      });

      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectId));
      }
    } catch (error) {
      console.error("Error updating project status:", error);
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

  const filteredProjects = showStarredOnly
    ? projects.filter((project) => project.is_starred)
    : projects;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            userInfo={userInfo}
            handleLike={handleLike}
            isDarkMode={isDarkMode}
            show_status={show_status}
          />
        ))}
      </div>
    </div>
  );
}
