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

export function ProjectCard({ project, userInfo, handleLike, isDarkMode, show_status, show_team = true, onStatusChange, onStarredChange, isAdmin, variant = "default", showTrendingBadge = false }: {
  project: Project;
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
  show_status: boolean;
  show_team?: boolean;
  onStatusChange?: (projectId: string, newStatus: string) => void;
  onStarredChange?: (projectId: string, isStarred: boolean) => void;
  isAdmin?: boolean;
  variant?: "default" | "compact" | "trending";
  showTrendingBadge?: boolean;
}) {
  const AvatarImage = ({ src, alt, size }: { src: string | null; alt: string; size: number }) => {
    const [imgSrc, setImgSrc] = useState<string>(src || "/images/default_avatar.png");
    return (
      <Image
        src={imgSrc}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover"
        onError={() => {
          if (imgSrc !== "/images/default_avatar.png") {
            setImgSrc("/images/default_avatar.png");
          }
        }}
      />
    );
  };
  const teamMembersBase = [
    { id: project.launchLead.id, name: project.launchLead.name, avatarUrl: project.launchLead.avatar?.url || null },
    ...project.participants.map(p => ({ id: p.hacker.id, name: p.hacker.name, avatarUrl: p.hacker.avatar?.url || null }))
  ];
  const uniqueById = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const m of teamMembersBase) {
    if (!uniqueById.has(m.id)) uniqueById.set(m.id, m);
  }
  const teamMembers = Array.from(uniqueById.values());
  const maxVisible = (variant === "compact" || variant === "trending") ? 5 : 6;
  const visibleMembers = teamMembers.slice(0, maxVisible);
  const remainingMembers = Math.max(0, teamMembers.length - visibleMembers.length);
  const imageHeightClass = (variant === "compact" || variant === "trending") ? "h-32" : "h-40 sm:h-48";
  const cardPaddingClass = variant === "compact" ? "p-3" : "p-4 sm:p-6";
  const titleClass =
    variant === "trending"
      ? "text-base font-bold"
      : variant === "compact"
      ? "text-base font-bold"
      : "text-lg sm:text-xl font-bold";
  const previewClass =
    variant === "trending"
      ? "text-xs"
      : variant === "compact"
      ? "text-sm"
      : "text-sm sm:text-base";
  // Keep a modest minimum height, but ensure spacing above tags even with long text
  const previewMinHeightClass = variant === "trending" ? "min-h-[28px]" : "min-h-[32px]";
  const maxTechTags = (variant === "compact" || variant === "trending") ? 3 : 99;
  const tagsBottomMarginClass = variant === "trending" ? "mb-0" : "mb-3";
  return (
    <div
      key={project.id}
      className={`${
        isDarkMode
          ? "bg-gray-800 hover:shadow-purple-400/20"
          : "bg-white hover:shadow-xl"
      } rounded-xl shadow-lg overflow-hidden transition-shadow transition-transform duration-200 hover:-translate-y-1 relative flex flex-col h-full`}
    >
      <div className={`relative ${imageHeightClass}`}>
        {showTrendingBadge && (
          <div className="absolute top-3 left-3 z-10">
            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
              isDarkMode 
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" 
                : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
            }`}>
              🔥 Trending
            </div>
          </div>
        )}
        {/* Like button - overlay top-right */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleLike(
                e,
                project.id,
                project.likes.some((like) => like.hackerId === userInfo?.id)
              );
            }}
            className={`p-3 rounded-full transition-all duration-200 shadow-lg ${
              project.likes.some((like) => like.hackerId === userInfo?.id)
                ? "bg-red-500 text-white hover:bg-red-600"
                : isDarkMode
                ? "bg-white/90 text-gray-800 hover:bg-red-500 hover:text-white"
                : "bg-white text-gray-800 hover:bg-red-500 hover:text-white"
            }`}
            aria-label={`Like project ${project.title}`}
          >
            <div className="flex items-center space-x-2">
              <svg className={`${project.likes.some((like) => like.hackerId === userInfo?.id) ? 'fill-current' : ''} w-5 h-5`} viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span className="text-sm font-bold">{project.likes.length}</span>
            </div>
          </button>
        </div>
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
      <div className={`${cardPaddingClass} flex-1 flex flex-col`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <Link href={`/projects/${project.id}`}>
              <h3
                className={`${titleClass} line-clamp-1 ${
                  isDarkMode
                    ? "text-gray-100 hover:text-purple-400"
                    : "text-gray-900 hover:text-indigo-600"
                } transition-colors`}
              >
                {project.title}
              </h3>
            </Link>
            {/* Launched position: under title for all variants */}
            <p
              className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              } mt-1`}
            >
              Launched on {new Date(project.startDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Avatars moved where heart was */}
            {show_team && (
              <div className="flex items-center">
                {visibleMembers.slice(0, 5).map((m, idx) => (
                  <Link
                    key={m.id}
                    href={`/hacker/${m.id}`}
                    title={m.name}
                    className={`${idx > 0 ? "-ml-2" : "ml-0"} inline-block rounded-full border-2 ${isDarkMode ? "border-gray-800" : "border-white"} hover:-translate-y-1 hover:scale-110 transition-transform duration-150`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ zIndex: (visibleMembers.length - idx) }}
                  >
                <AvatarImage src={m.avatarUrl} alt={m.name} size={24} />
                  </Link>
                ))}
                {teamMembers.length > 5 && (
                  <div className={`-ml-2 w-6 h-6 rounded-full flex items-center justify-center text-xs ${isDarkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"} border-2 ${isDarkMode ? "border-gray-800" : "border-white"}`}>
                    +{teamMembers.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Link href={`/projects/${project.id}`}>
          <p
            className={`${previewClass} ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } ${previewMinHeightClass} mb-2`}
          >
            {project.preview}
          </p>
        </Link>

        {/* Tags Section - anchored at bottom of content */}
        <div className={`flex flex-wrap gap-2 mt-auto ${tagsBottomMarginClass} min-h-[24px]`}>
          {project.techTags.slice(0, maxTechTags).map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center h-6 px-2 rounded-full text-xs font-medium ${
                isDarkMode
                  ? "bg-purple-900/50 text-purple-300"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {tag.name}
            </span>
          ))}
          {variant === "default" && project.domainTags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center h-6 px-2 rounded-full text-xs font-medium ${
                isDarkMode
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {tag.name}
            </span>
          ))}
          {(variant === "compact" || variant === "trending") && project.techTags.length > maxTechTags && (
            <span className={`inline-flex items-center h-6 px-2 rounded-full text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              +{project.techTags.length - maxTechTags}
            </span>
          )}
        </div>

        {/* Removed duplicate stacked avatars below; avatars are shown in the header area now */}

        {/* Footer: only render for non-trending variant; no extra spacer */}
        {variant !== "trending" && (
          <div className={`pt-4 border-t border-gray-200 flex items-center justify-between`}>
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
        )}
      </div>
    </div>
  );
}

export default function ProjectGrid({ 
  showStarredOnly = false, 
  statusFilter = "APPROVED", 
  show_status = false, 
  show_team = true,
  showSearch = false,
  urlFilters = {},
  variant = "default"
}: {
  showStarredOnly?: boolean;
  statusFilter?: string;
  show_status?: boolean;
  show_team?: boolean;
  showSearch?: boolean;
  urlFilters?: {
    techTags?: string[];
    domainTags?: string[];
    search?: string;
    fromDate?: string;
    toDate?: string;
    status?: string[];
    sort?: string;
  };
  variant?: "default" | "compact";
}) {
  const { user } = useUser();
  const { isAdmin, userInfo } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();

  // Update projects when they're loaded (only if no search/filtering active)
  useEffect(() => {
    if (projects.length > 0 && !showSearch) {
      setFilteredProjects(projects);
    }
  }, [projects, showSearch]);

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
          urlFilters={urlFilters}
        />
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${variant === "compact" ? "gap-3 sm:gap-4" : "gap-4 sm:gap-6"}`}>
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
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
