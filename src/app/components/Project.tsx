"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import ProjectSearch from "./ProjectSearch";
import { swapFirstLetters } from "../utils/nameUtils";

export type Project = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED';
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
    twitterUrl?: string | null;
    linkedinUrl?: string | null;
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
      twitterUrl?: string | null;
      linkedinUrl?: string | null;
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

const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'APPROVED'] as const;

function ProjectCard({ project, userInfo, handleLike, isDarkMode, show_status, show_team = true, onStatusChange, onStarredChange, isAdmin }: {
  project: Project;
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
  show_status: boolean;
  show_team?: boolean;
  onStatusChange?: (projectId: string, newStatus: string) => void;
  onStarredChange?: (projectId: string, isStarred: boolean) => void;
  isAdmin?: boolean;
}) {
  return (
    <div
      key={project.id}
      className={`${
        isDarkMode
          ? "bg-gray-800 hover:shadow-purple-400/20"
          : "bg-white hover:shadow-xl"
      } rounded-lg shadow-lg overflow-hidden transition-shadow relative flex flex-col h-full`}
    >
      <div className="relative h-40 sm:h-48">
        <Link href={`/projects/${project.id}`}>
          <Image
            src={
              project.thumbnail?.url ||
              (isDarkMode
                ? "/images/default_project_thumbnail_dark.svg"
                : "/images/default_project_thumbnail_light.svg")
            }
            alt={project.title}
            fill
            className="object-cover"
            unoptimized
          />
        </Link>
        {show_status && (
          <div className="absolute top-2 right-2 flex space-x-2">
            {isAdmin ? (
              <>
                <button
                  onClick={() => onStarredChange?.(project.id, !project.is_starred)}
                  className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                    project.is_starred
                      ? "bg-yellow-300 text-yellow-800 hover:bg-yellow-400"
                      : "bg-gray-300 text-gray-800 hover:bg-gray-400"
                  }`}
                >
                  {project.is_starred ? "Starred" : "Not Starred"}
                </button>
                
                <Listbox value={project.status} onChange={(newStatus) => onStatusChange?.(project.id, newStatus)}>
                  <div className="relative">
                    <Listbox.Button className={`px-2 py-1 rounded-full text-xs flex items-center ${
                      project.status === "DRAFT"
                        ? "bg-gray-300 text-gray-800"
                        : project.status === "PENDING"
                        ? "bg-orange-300 text-orange-800"
                        : "bg-green-300 text-green-800"
                    }`}>
                      <span>{project.status}</span>
                      <ChevronUpDownIcon className="h-4 w-4 ml-1" />
                    </Listbox.Button>
                    <Transition
                      enter="transition duration-100 ease-out"
                      enterFrom="transform scale-95 opacity-0"
                      enterTo="transform scale-100 opacity-100"
                      leave="transition duration-75 ease-out"
                      leaveFrom="transform scale-100 opacity-100"
                      leaveTo="transform scale-95 opacity-0"
                    >
                      <Listbox.Options className={`absolute right-0 mt-1 w-32 rounded-md shadow-lg z-10 ${
                        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
                      }`}>
                        {STATUS_OPTIONS.map((status) => (
                          <Listbox.Option
                            key={status}
                            value={status}
                            className={({ active }) =>
                              `${active 
                                ? isDarkMode 
                                  ? 'bg-gray-700 text-purple-400' 
                                  : 'bg-indigo-100 text-indigo-900'
                                : isDarkMode
                                  ? 'bg-gray-800 text-gray-300'
                                  : 'bg-white text-gray-900'
                              } cursor-pointer select-none relative py-2 px-4`
                            }
                          >
                            {status}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
      <div className="p-4 sm:p-6 flex-1 flex flex-col">
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
              Launched on {new Date(project.startDate).toLocaleDateString()}
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
                {/* <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-sm">
                  {project.likes.length}
                </span> */}
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
        {show_team && (
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
                      {swapFirstLetters(project.launchLead.name)}
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

              {/* Other Participants - Limited to 4 (plus Launch Lead = 5 total) */}
              {project.participants.slice(0, 4).map((participant) => (
                <div
                  key={participant.hacker.id}
                  className="flex items-center"
                >
                  <div className="flex-shrink-0">
                    {participant.hacker.avatar ? (
                      <Image
                        src={participant.hacker.avatar.url}
                        alt={swapFirstLetters(participant.hacker.name)}
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
                          {swapFirstLetters(participant.hacker.name)[0]}
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
                        {swapFirstLetters(participant.hacker.name)}
                      </p>
                    </Link>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {participant.role === "hacker" ? "builder" : participant.role}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Show count of additional members if any */}
              {project.participants.length > 4 && (
                <div className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                } mt-2`}>
                  +{project.participants.length - 4} more team members
                </div>
              )}
            </div>
          </div>
        )}

        {/* Links - Modified to stick to bottom */}
        <div className="flex justify-between mt-auto pt-4 border-t border-gray-200">
          <div className="flex-1">
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
          </div>
          <div className="flex-1 text-center">
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
          <div className="flex-1 text-right">
            <Link
              href={`/projects/${project.id}`}
              className={`${
                isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
              } text-xs sm:text-sm font-medium`}
              target="_blank"
            >
              More Info →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectGrid({ 
  showStarredOnly = false, 
  statusFilter = "APPROVED", 
  show_status = false, 
  show_team = true,
  showSearch = false
}) {
  const { user } = useUser();
  const { isAdmin, userInfo } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();

  // Update projects when they're loaded
  useEffect(() => {
    if (projects.length > 0) {
      setFilteredProjects(projects);
    }
  }, [projects]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const queryParam = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
        const response = await fetch(`/api/projects${queryParam}`);
        const data = await response.json();
        
        // Sort projects by startDate (newest first) before setting state
        const sortedProjects = [...data].sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
        });
        
        setProjects(sortedProjects);
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
                        hackerId: userInfo?.id || '',
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

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    if (!isAdmin) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setProjects(projects.map(p => 
          p.id === projectId ? { ...p, status: newStatus as "DRAFT" | "PENDING" | "APPROVED" } : p
        ));
        toast.success('Project status updated successfully');
      } else {
        toast.error('Failed to update project status');
      }
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Failed to update project status');
    }
  };

  const handleStarredChange = async (projectId: string, isStarred: boolean) => {
    if (!isAdmin) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/star`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_starred: isStarred }),
      });

      if (response.ok) {
        setProjects(projects.map(p => 
          p.id === projectId ? { ...p, is_starred: isStarred } : p
        ));
        toast.success(`Project ${isStarred ? 'starred' : 'unstarred'} successfully`);
      } else {
        toast.error(`Failed to ${isStarred ? 'star' : 'unstar'} project`);
      }
    } catch (error) {
      console.error('Error updating project starred status:', error);
      toast.error(`Failed to ${isStarred ? 'star' : 'unstar'} project`);
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

  const displayProjects = showStarredOnly
    ? filteredProjects.filter((project) => project.is_starred)
    : filteredProjects;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-12">
      {showSearch && (
        <ProjectSearch 
          projects={projects} 
          onFilteredProjectsChange={setFilteredProjects} 
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {displayProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            userInfo={userInfo}
            handleLike={handleLike}
            isDarkMode={isDarkMode}
            show_status={show_status}
            show_team={show_team}
            onStatusChange={handleStatusChange}
            onStarredChange={handleStarredChange}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}
