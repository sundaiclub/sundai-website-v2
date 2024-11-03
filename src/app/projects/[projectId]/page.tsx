"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useUserContext } from "../../contexts/UserContext";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

type Project = {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED";
  githubUrl?: string | null;
  demoUrl?: string | null;
  thumbnail?: { url: string } | null;
  launchLead: {
    id: string;
    name: string;
    avatar?: { url: string } | null;
  };
  participants: Array<{
    role: string;
    hacker: {
      id: string;
      name: string;
      bio?: string | null;
      avatar?: { url: string } | null;
    };
  }>;
  startDate: string;
  endDate?: string | null;
  likes: Array<{ hackerId: string; createdAt: string }>;
};

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const { userInfo } = useUserContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params.projectId}`);
        if (!response.ok) throw new Error("Project not found");
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error("Error fetching project:", error);
        router.push("/projects");
      } finally {
        setLoading(false);
      }
    };

    if (params.projectId) fetchProject();
  }, [params.projectId, router]);

  useEffect(() => {
    if (project && userInfo) {
      setIsLiked(project.likes.some((like) => like.hackerId === userInfo.id));
      setLikeCount(project.likes.length);
    }
  }, [project, userInfo]);

  const handleLike = async () => {
    if (!userInfo) {
      alert("Please sign in to like projects");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project?.id}/like`, {
        method: isLiked ? "DELETE" : "POST",
      });

      if (response.ok) {
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center full-height-screen">
        <div className="spinner spinner-small"></div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="full-height-screen py-20 px-4 page-background-light">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Project Header */}
          <div className="project-header">
            <Image
              src={project.thumbnail?.url || "/images/projects_screenshots/week-25.jpg"}
              alt={project.title}
              fill
              className="object-cover"
            />
            <div className="project-title-overlay" />
            <div className="project-title-container">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
                  <div className="flex items-center space-x-2">
                    <span className={`status-badge ${project.status === "APPROVED" ? "status-badge-approved" : "status-badge-pending"}`}>
                      {project.status}
                    </span>
                    <span className="text-sm">Started {new Date(project.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={handleLike}
                  className="like-button px-4 py-2 rounded-full"
                >
                  {isLiked ? (
                    <HeartIconSolid className="h-6 w-6 text-red-500" />
                  ) : (
                    <HeartIcon className="h-6 w-6 text-white" />
                  )}
                  <span>{likeCount}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Project Content */}
          <div className="p-6">
            <div className="prose max-w-none mb-8 text-gray-700">{project.description}</div>

            {/* Links Section */}
            <div className="flex space-x-4 mb-8">
              {project.demoUrl && (
                <Link href={project.demoUrl} target="_blank" className="primary-button primary-button-blue">
                  View Demo
                </Link>
              )}
              {project.githubUrl && (
                <Link href={project.githubUrl} target="_blank" className="primary-button primary-button-gray">
                  GitHub Repository
                </Link>
              )}
            </div>

            {/* Team Section */}
            <div>
              <h2 className="text-xl font-bold mb-4">Team</h2>

              {/* Launch Lead */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Launch Lead</h3>
                <Link href={`/hacker/${project.launchLead.id}`}>
                  <div className="team-member-card hover:bg-gray-100">
                    <div className="avatar-large">
                      {project.launchLead.avatar ? (
                        <Image
                          src={project.launchLead.avatar.url}
                          alt={project.launchLead.name}
                          fill
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          <span className="text-lg font-semibold text-gray-900">{project.launchLead.name[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <h4 className="text-lg font-semibold text-gray-900">{project.launchLead.name}</h4>
                      <p className="text-sm text-indigo-600">Launch Lead</p>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Team Members */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Team Members</h3>
                <div className="space-y-3">
                  {project.participants.map((participant) => (
                    <Link key={participant.hacker.id} href={`/hacker/${participant.hacker.id}`}>
                      <div className="team-member-card hover:bg-gray-100">
                        <div className="avatar-large">
                          {participant.hacker.avatar ? (
                            <Image
                              src={participant.hacker.avatar.url}
                              alt={participant.hacker.name}
                              fill
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="avatar-placeholder avatar-placeholder-gray">
                              <span className="text-lg font-semibold text-gray-900">{participant.hacker.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <h4 className="text-lg font-semibold text-gray-900">{participant.hacker.name}</h4>
                          <p className="text-sm text-gray-600">{participant.role}</p>
                          {participant.hacker.bio && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{participant.hacker.bio}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}