"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useUserContext } from "@/app/contexts/UserContext";
import Image from "next/image";
import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/solid";

type HackerProfile = {
  id: string;
  name: string;
  bio: string | null;
  email: string | null;
  githubUrl: string | null;
  phoneNumber: string | null;
  avatar?: {
    url: string;
  } | null;
  projects: Array<{
    role: string;
    project: {
      id: string;
      title: string;
      description: string;
      thumbnail?: {
        url: string;
      } | null;
      status: "PENDING" | "APPROVED";
      likes: Array<{
        hackerId: string;
        createdAt: string;
      }>;
    };
  }>;
  ledProjects: Array<{
    id: string;
    title: string;
    description: string;
    thumbnail?: {
      url: string;
    } | null;
    status: "PENDING" | "APPROVED";
  }>;
  likedProjects: Array<{
    createdAt: string;
    project: {
      id: string;
      title: string;
      description: string;
      thumbnail?: {
        url: string;
      } | null;
      status: "PENDING" | "APPROVED";
      launchLead: {
        name: string;
        avatar?: {
          url: string;
        } | null;
      };
      likes: Array<{
        hackerId: string;
        createdAt: string;
      }>;
    };
  }>;
};

export default function HackerProfile() {
  const params = useParams();
  const { userInfo } = useUserContext();
  const [hacker, setHacker] = useState<HackerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = userInfo?.id === params.hackerId;

  useEffect(() => {
    const fetchHacker = async () => {
      try {
        const response = await fetch(`/api/hackers/${params.hackerId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch hacker data");
        }
        const data = await response.json();
        setHacker({
          ...data,
          ledProjects: data.ledProjects || [],
          projects: data.projects || [],
          likedProjects: data.likedProjects || [],
        });
      } catch (error) {
        console.error("Error fetching hacker data:", error);
        setHacker(null);
      } finally {
        setLoading(false);
      }
    };

    if (params.hackerId) {
      fetchHacker();
    }
  }, [params.hackerId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center full-height-screen">
        <div className="spinner spinner-small"></div>
      </div>
    );
  }

  if (!hacker) {
    return (
      <div className="full-height-screen page-background-light flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h1>
          <p className="text-gray-600">The requested profile could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="full-height-screen py-20 page-background">
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <div className="profile-card">
          <div className="profile-header-bg h-32 sm:h-48"></div>
          <div className="px-4 sm:px-8 pb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 sm:-mt-24 mb-4 sm:mb-8">
              <div className="avatar-large">
                {hacker.avatar ? (
                  <Image
                    src={hacker.avatar.url}
                    alt={hacker.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="avatar-placeholder-large">
                    <span className="text-4xl sm:text-6xl font-bold text-indigo-600">
                      {hacker.name[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
                <h1 className="section-title">{hacker.name}</h1>
                {hacker.bio && <p className="text-gray-600 max-w-2xl">{hacker.bio}</p>}
              </div>
            </div>

            {/* Contact & Links */}
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              {hacker.githubUrl && (
                <Link
                  href={hacker.githubUrl}
                  target="_blank"
                  className="link-button bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <svg className="icon-md mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-.1"
                    />
                  </svg>
                  GitHub
                </Link>
              )}
              {hacker.email && (
                <Link
                  href={`mailto:${hacker.email}`}
                  className="link-button bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <svg className="icon-md mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Email
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="space-y-8">
          {/* Led Projects */}
          {hacker.ledProjects.length > 0 && (
            <div className="mb-12">
              <h2 className="section-title">Projects Led</h2>
              <div className="scrollable-section">
                {hacker.ledProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="project-card">
                    <div className="relative h-48">
                      <Image
                        src={project.thumbnail?.url || "/images/projects_screenshots/week-25.jpg"}
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                      {project.status === "PENDING" && (
                        <div className="status-badge-pending">Pending</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{project.title}</h3>
                      <p className="text-gray-600 line-clamp-2">{project.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Participated Projects */}
          {hacker.projects.length > 0 && (
            <div className="mb-12">
              <h2 className="section-title">Projects Contributed To</h2>
              <div className="scrollable-section">
                {hacker.projects.map(({ project, role }) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="project-card">
                    <div className="relative h-48">
                      <Image
                        src={project.thumbnail?.url || "/images/projects_screenshots/week-25.jpg"}
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                      <div className="badge-role">{role}</div>
                      {project.status === "PENDING" && (
                        <div className="status-badge-pending">Pending</div>
                      )}
                      <div className="badge-likes">
                        <HeartIcon className="h-4 w-4 text-white" />
                        <span className="text-white text-sm">{project.likes.length || 0}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{project.title}</h3>
                      <p className="text-gray-600 line-clamp-2">{project.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Liked Projects */}
          {hacker.likedProjects.length > 0 && (
            <div className="mb-12">
              <h2 className="section-title">Liked Projects</h2>
              <div className="scrollable-section">
                {hacker.likedProjects.map(({ project, createdAt }) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="project-card">
                    <div className="relative h-48">
                      <Image
                        src={project.thumbnail?.url || "/images/projects_screenshots/week-25.jpg"}
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                      <div className="badge-likes">
                        <HeartIcon className="h-4 w-4 text-white" />
                        <span className="text-white text-sm">{project.likes.length}</span>
                      </div>
                      {project.status === "PENDING" && (
                        <div className="status-badge-pending">Pending</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{project.title}</h3>
                        <span className="text-xs text-gray-500">
                          {new Date(createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 line-clamp-2">{project.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(!hacker.projects.length && !hacker.ledProjects.length) && (
            <div className="text-center py-12 empty-state">
              <p className="empty-state-text">No projects yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}