"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useUserContext } from "@/app/contexts/UserContext";
import Image from "next/image";
import Link from "next/link";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
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
    };
  }>;
};

// Add this CSS class to your globals.css or a new CSS module
const scrollableSection = `
  overflow-x-auto
  flex
  space-x-6
  pb-4
  scrollbar-thin
  scrollbar-thumb-gray-300
  scrollbar-track-transparent
  hover:scrollbar-thumb-gray-400
  -mx-4
  px-4
`;

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
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!hacker) {
    return (
      <div className="min-h-screen py-20 bg-[#E5E5E5] flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Profile Not Found
          </h1>
          <p className="text-gray-600">
            The requested profile could not be found.
          </p>
        </div>
      </div>
    );
  }

  // if (isOwnProfile) {
  //   // Return existing edit profile view
  //   return (
  //     <div className="min-h-screen py-16 text-gray-800">
  //       {/* ... existing profile edit UI ... */}
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen py-20 bg-[#E5E5E5]">
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 sm:h-48"></div>
          <div className="px-4 sm:px-8 pb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 sm:-mt-24 mb-4 sm:mb-8">
              <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
                {hacker.avatar ? (
                  <Image
                    src={hacker.avatar.url}
                    alt={hacker.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-4xl sm:text-6xl font-bold text-indigo-600">
                      {hacker.name[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-900">
                  {hacker.name}
                </h1>
                {hacker.bio && (
                  <p className="mt-2 text-gray-600 max-w-2xl">{hacker.bio}</p>
                )}
              </div>
            </div>

            {/* Contact & Links */}
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              {hacker.githubUrl && (
                <Link
                  href={hacker.githubUrl}
                  target="_blank"
                  className="flex items-center px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                    />
                  </svg>
                  GitHub
                </Link>
              )}
              {hacker.email && (
                <Link
                  href={`mailto:${hacker.email}`}
                  className="flex items-center px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
          {Array.isArray(hacker.ledProjects) &&
            hacker.ledProjects.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Projects Led
                </h2>
                <div className={scrollableSection}>
                  {hacker.ledProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                    >
                      <div className="relative h-48">
                        <Image
                          src={
                            project.thumbnail?.url ||
                            "/images/projects_screenshots/week-25.jpg"
                          }
                          alt={project.title}
                          fill
                          className="object-cover"
                        />
                        {project.status === "PENDING" && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-sm rounded-full">
                            Pending
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {project.title}
                        </h3>
                        <p className="text-gray-600 line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* Participated Projects */}
          {Array.isArray(hacker.projects) && hacker.projects.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Projects Contributed To
              </h2>
              <div className={scrollableSection}>
                {hacker.projects.map(({ project, role }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="relative h-48">
                      <Image
                        src={
                          project.thumbnail?.url ||
                          "/images/projects_screenshots/week-25.jpg"
                        }
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-indigo-600 text-white text-sm rounded-full">
                        {role}
                      </div>
                      {project.status === "PENDING" && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-sm rounded-full">
                          Pending
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-full">
                        <HeartIcon className="h-4 w-4 text-white" />
                        <span className="text-white text-sm">
                          {project.likes?.length || 0}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {project.title}
                      </h3>
                      <p className="text-gray-600 line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Liked Projects */}
          {Array.isArray(hacker.likedProjects) &&
            hacker.likedProjects.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Liked Projects
                </h2>
                <div className={scrollableSection}>
                  {hacker.likedProjects.map(({ project, createdAt }) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                    >
                      <div className="relative h-48">
                        <Image
                          src={
                            project.thumbnail?.url ||
                            "/images/projects_screenshots/week-25.jpg"
                          }
                          alt={project.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute bottom-2 left-2 flex items-center space-x-2 bg-black/50 px-3 py-1 rounded-full">
                          {project.launchLead.avatar ? (
                            <Image
                              src={project.launchLead.avatar.url}
                              alt={project.launchLead.name}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 text-xs">
                                {project.launchLead.name[0]}
                              </span>
                            </div>
                          )}
                          <span className="text-white text-sm">
                            {project.launchLead.name}
                          </span>
                        </div>
                        {project.status === "PENDING" && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-sm rounded-full">
                            Pending
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {project.title}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {new Date(createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600 line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {(!Array.isArray(hacker.projects) || hacker.projects.length === 0) &&
            (!Array.isArray(hacker.ledProjects) ||
              hacker.ledProjects.length === 0) && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-600">No projects yet</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
