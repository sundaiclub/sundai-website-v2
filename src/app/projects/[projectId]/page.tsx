"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useUserContext } from "../../contexts/UserContext";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useTheme } from "../../contexts/ThemeContext";

type Project = {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED";
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
      bio?: string | null;
      avatar?: {
        url: string;
      } | null;
    };
  }>;
  startDate: string;
  endDate?: string | null;
  likes: Array<{
    hackerId: string;
    createdAt: string;
  }>;
};

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const { userInfo } = useUserContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params.projectId}`);
        if (!response.ok) {
          throw new Error("Project not found");
        }
        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error("Error fetching project:", error);
        router.push("/projects");
      } finally {
        setLoading(false);
      }
    };

    if (params.projectId) {
      fetchProject();
    }
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
      <div className="flex justify-center items-center min-h-screen">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
            isDarkMode ? "border-purple-400" : "border-indigo-600"
          }`}
        ></div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div
      className={`min-h-screen py-12 px-4 md:py-20 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
      } font-space-mono`}
    >
      <div className="max-w-7xl mx-auto">
        <div className={`shadow-lg overflow-hidden`}>
          {/* Project Header - Now with larger height on desktop */}
          <div className="relative h-64 md:h-96 w-full">
            <Image
              src={
                project.thumbnail?.url ||
                "/images/projects_screenshots/week-25.jpg"
              }
              alt={project.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 p-6 md:p-10 text-white w-full">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between max-w-6xl mx-auto">
                <div className="mb-4 md:mb-0">
                  <h1 className="text-3xl md:text-5xl font-bold mb-4">
                    {project.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-4 py-1.5 rounded-full text-sm md:text-base ${
                        project.status === "APPROVED"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {project.status}
                    </span>
                    <span className="text-sm md:text-base">
                      Started {new Date(project.startDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="mt-4 md:mt-0">
                  <button
                    onClick={handleLike}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full hover:bg-white/30 transition-colors"
                  >
                    {isLiked ? (
                      <HeartIconSolid className="h-6 w-6 text-red-500" />
                    ) : (
                      <HeartIcon className="h-6 w-6 text-white" />
                    )}
                    <span className="text-lg">{likeCount}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Content - Now with two-column layout on desktop */}
          <div className="p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
              <div className="md:grid md:grid-cols-12 md:gap-12">
                {/* Main Content Column */}
                <div className="md:col-span-7 lg:col-span-8">
                  <div className="prose max-w-none mb-8">
                    <p
                      className={`text-lg ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {project.description}
                    </p>
                  </div>

                  {/* Links Section */}
                  <div className="flex flex-wrap gap-4 mb-8">
                    {project.demoUrl && (
                      <Link
                        href={project.demoUrl}
                        className={`px-6 py-3 rounded-lg transition-colors ${
                          isDarkMode
                            ? "bg-indigo-700 hover:bg-indigo-600"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        } text-white text-lg`}
                        target="_blank"
                      >
                        View Demo
                      </Link>
                    )}
                    {project.githubUrl && (
                      <Link
                        href={project.githubUrl}
                        className={`px-6 py-3 rounded-lg transition-colors ${
                          isDarkMode
                            ? "bg-gray-700 hover:bg-gray-600"
                            : "bg-gray-800 hover:bg-gray-900"
                        } text-white text-lg`}
                        target="_blank"
                      >
                        GitHub Repository
                      </Link>
                    )}
                  </div>
                </div>

                {/* Team Sidebar */}
                <div className="md:col-span-5 lg:col-span-4">
                  <div
                    className={`p-6 ${
                      isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
                    }`}
                  >
                    <h2
                      className={`text-2xl font-bold mb-6 ${
                        isDarkMode ? "text-gray-100" : "text-gray-900"
                      }`}
                    >
                      Team
                    </h2>

                    {/* Launch Lead */}
                    <div className="mb-8">
                      <h3
                        className={`text-sm font-semibold mb-3 ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        Launch Lead
                      </h3>
                      <Link href={`/hacker/${project.launchLead.id}`}>
                        <div
                          className={`flex items-center p-4 rounded-lg transition-colors ${
                            isDarkMode
                              ? "bg-gray-700 hover:bg-gray-600"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                        >
                          <div className="relative w-12 h-12">
                            {project.launchLead.avatar ? (
                              <Image
                                src={project.launchLead.avatar.url}
                                alt={project.launchLead.name}
                                fill
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-indigo-600 text-lg font-semibold text-gray-900">
                                  {project.launchLead.name[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <h4
                              className={`text-lg font-semibold ${
                                isDarkMode ? "text-gray-100" : "text-gray-900"
                              }`}
                            >
                              {project.launchLead.name}
                            </h4>
                            <p className="text-sm text-indigo-600">
                              Launch Lead
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Team Members */}
                    <div>
                      <h3
                        className={`text-sm font-semibold mb-3 ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        Team Members
                      </h3>
                      <div className="flex flex-col gap-2">
                        {project.participants.map((participant) => (
                          <Link
                            key={participant.hacker.id}
                            href={`/hacker/${participant.hacker.id}`}
                          >
                            <div
                              className={`flex items-center p-2 rounded-lg transition-colors ${
                                isDarkMode
                                  ? "bg-gray-700 hover:bg-gray-600"
                                  : "bg-gray-50 hover:bg-gray-100"
                              }`}
                            >
                              <div className="relative w-12 h-12">
                                {participant.hacker.avatar ? (
                                  <Image
                                    src={participant.hacker.avatar.url}
                                    alt={participant.hacker.name}
                                    fill
                                    className="rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center">
                                    <span className="text-gray-600 text-lg font-semibold text-gray-900">
                                      {participant.hacker.name[0]}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <h4
                                  className={`text-lg font-semibold ${
                                    isDarkMode
                                      ? "text-gray-100"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {participant.hacker.name}
                                </h4>
                                <p
                                  className={`text-sm ${
                                    isDarkMode
                                      ? "text-indigo-400"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {participant.role}
                                </p>
                                {participant.hacker.bio && (
                                  <p
                                    className={`text-sm mt-1 line-clamp-2 ${
                                      isDarkMode
                                        ? "text-gray-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {participant.hacker.bio}
                                  </p>
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
        </div>
      </div>
    </div>
  );
}
