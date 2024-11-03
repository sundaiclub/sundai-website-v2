"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useUserContext } from "../contexts/UserContext";

type Project = {
  id: string;
  title: string;
  description: string;
  githubUrl?: string | null;
  demoUrl?: string | null;
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

export default function ProjectCard() {
  const { user } = useUser();
  const { isAdmin } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects?status=APPROVED");
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const handleLike = async (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => {
    e.preventDefault();
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
                  ? project.likes.filter((like) => like.hackerId !== user.id)
                  : [
                      ...project.likes,
                      {
                        hackerId: user.id,
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
        <div className="spinner spinner-small"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="card card-hover project-card">
            <div className="relative h-40 sm:h-48">
              <Link href={`/projects/${project.id}`}>
                <Image
                  src={
                    project.thumbnail?.url ||
                    "/images/projects_screenshots/week-25.jpg"
                  }
                  alt={project.title}
                  fill
                  className="object-cover rounded-t-lg"
                />
              </Link>
            </div>
            <div className="card-content">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Link href={`/projects/${project.id}`}>
                    <h3 className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                      {project.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) =>
                    handleLike(
                      e,
                      project.id,
                      project.likes.some((like) => like.hackerId === user?.id)
                    )
                  }
                  className="like-button"
                  aria-label={`Like project ${project.title}`}
                >
                  <div className="relative">
                    {project.likes.some((like) => like.hackerId === user?.id) ? (
                      <HeartIconSolid className="h-7 w-7 text-indigo-600" />
                    ) : (
                      <HeartIcon className="h-7 w-7" />
                    )}
                    <span className="like-counter">
                      {project.likes.length}
                    </span>
                  </div>
                </button>
              </div>

              <Link href={`/projects/${project.id}`}>
                <p className="text-sm text-gray-600 mb-4">{project.description}</p>
              </Link>

              {/* Team Section */}
              <div className="mb-4">
                <h4 className="section-header">Team</h4>
                <div className="space-y-2">
                  {/* Launch Lead */}
                  <div className="team-member-card">
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
                        <div className="avatar-placeholder avatar-placeholder-lead w-7 h-7">
                          <span className="text-xs">
                            {project.launchLead.name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {project.launchLead.name}
                      </p>
                      <p className="team-role">Launch Lead</p>
                    </div>
                  </div>

                  {/* Other Participants */}
                  {project.participants.map((participant) => (
                    <div
                      key={participant.hacker.id}
                      className="team-member-card"
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
                          <div className="avatar-placeholder avatar-placeholder-participant w-7 h-7">
                            <span className="text-xs">
                              {participant.hacker.name[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {participant.hacker.name}
                        </p>
                        <p className="text-xs text-gray-500">{participant.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="flex space-x-4 mt-4 pt-4 border-t">
                {project.demoUrl && (
                  <Link
                    href={project.demoUrl}
                    className="link-button link-button-demo"
                    target="_blank"
                  >
                    View Demo →
                  </Link>
                )}
                {project.githubUrl && (
                  <Link
                    href={project.githubUrl}
                    className="link-button link-button-github"
                    target="_blank"
                  >
                    GitHub →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}