"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import NextImage from "next/image";
import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/solid";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useTheme } from "../../contexts/ThemeContext";
import { swapFirstLetters } from "../../utils/nameUtils";

type ProjectSummary = {
  id: string;
  title: string;
  description: string;
  thumbnail?: {
    url: string;
  } | null;
  status: "PENDING" | "APPROVED";
  startDate?: string | null;
  createdAt?: string | null;
  likes: Array<{
    hackerId: string;
    createdAt: string;
  }>;
};

type HackerProfile = {
  id: string;
  name: string;
  username: string | null;
  bio: string | null;
  email: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  discordName: string | null;
  websiteUrl: string | null;
  phoneNumber: string | null;
  avatar?: {
    url: string;
  } | null;
  projects: Array<{
    role: string;
    project: ProjectSummary;
  }>;
  ledProjects: ProjectSummary[];
};

type EditableFields = {
  name: string;
  username: string;
  bio: string;
  githubUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  discordName: string;
  websiteUrl: string;
  phoneNumber: string;
};

type ProjectFilter = "all" | "led" | "contributed";
type ProjectSort = "recent" | "liked";

type DisplayProject = {
  project: ProjectSummary;
  source: "led" | "contributed";
  role: string;
};

const getStatusBadgeClasses = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-gray-500";
    case "PENDING":
      return "bg-orange-500";
    case "APPROVED":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

export default function HackerProfile() {
  const params = useParams();
  const { user } = useUser();
  const [hacker, setHacker] = useState<HackerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditableFields>({
    name: "",
    username: "",
    bio: "",
    githubUrl: "",
    linkedinUrl: "",
    twitterUrl: "",
    discordName: "",
    websiteUrl: "",
    phoneNumber: "",
  });
  const [currentUserHackerId, setCurrentUserHackerId] = useState<string | null>(
    null
  );
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("recent");
  const { isDarkMode } = useTheme();

  const AvatarImage = ({ src, alt, size }: { src: string | null; alt: string; size: number }) => {
    const defaultSrc = "/images/default_avatar.png";

    const [imgSrc, setImgSrc] = useState<string>(defaultSrc);

    useEffect(() => {
      if (!src) {
        setImgSrc(defaultSrc);
        return;
      }
      try {
        const GlobalImage = (typeof globalThis !== 'undefined' ? (globalThis as any).Image : undefined);
        const preloader = GlobalImage ? new GlobalImage() : null;
        if (preloader) {
          preloader.onload = () => setImgSrc(src);
          preloader.onerror = () => setImgSrc(defaultSrc);
          preloader.src = src;
        } else {
          setImgSrc(src);
        }
      } catch {
        setImgSrc(defaultSrc);
      }
    }, [src]);

    return (
      <img
        src={imgSrc}
        alt={alt}
        width={size}
        height={size}
        className="object-cover rounded-full"
        onError={(e) => {
          if ((e.currentTarget as HTMLImageElement).src !== defaultSrc) {
            (e.currentTarget as HTMLImageElement).src = defaultSrc;
            setImgSrc(defaultSrc);
          }
        }}
        onErrorCapture={() => {
          setImgSrc((current) => (current === defaultSrc ? current : defaultSrc));
        }}
      />
    );
  };

  useEffect(() => {
    const fetchCurrentUserHackerId = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/hackers?clerkId=${user.id}`);
          if (response.ok) {
            const data = await response.json();
            setCurrentUserHackerId(data.id);
          }
        } catch (error) {
          console.error("Error fetching current user hacker ID:", error);
        }
      }
    };

    fetchCurrentUserHackerId();
  }, [user?.id]);

  const isOwnProfile = currentUserHackerId === params?.hackerId;

  useEffect(() => {
    if (hacker) {
      setEditForm({
        name: hacker.name || "",
        username: hacker.username || "",
        bio: hacker.bio || "",
        githubUrl: hacker.githubUrl || "",
        linkedinUrl: hacker.linkedinUrl || "",
        twitterUrl: hacker.twitterUrl || "",
        discordName: hacker.discordName || "",
        websiteUrl: hacker.websiteUrl || "",
        phoneNumber: hacker.phoneNumber || "",
      });
    }
  }, [hacker]);

  useEffect(() => {
    const fetchHacker = async () => {
      try {
        const response = await fetch(`/api/hackers/${params?.hackerId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch hacker data");
        }
        const data = await response.json();
        setHacker({
          ...data,
          ledProjects: data.ledProjects || [],
          projects: data.projects || [],
        });
      } catch (error) {
        console.error("Error fetching hacker data:", error);
        setHacker(null);
      } finally {
        setLoading(false);
      }
    };

    if (params?.hackerId) {
      fetchHacker();
    }
  }, [params?.hackerId]);

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsEditing(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isEditing]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/hackers/${params?.hackerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedHacker = await response.json();
      setHacker((prev) => ({ ...prev!, ...updatedHacker }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const allProjects: DisplayProject[] = useMemo(() => {
    if (!hacker) return [];
    const seen = new Set<string>();
    const out: DisplayProject[] = [];
    for (const project of hacker.ledProjects || []) {
      if (seen.has(project.id)) continue;
      seen.add(project.id);
      out.push({ project, source: "led", role: "Lead" });
    }
    for (const { project, role } of hacker.projects || []) {
      if (seen.has(project.id)) continue;
      seen.add(project.id);
      out.push({ project, source: "contributed", role: role || "Contributor" });
    }
    return out;
  }, [hacker]);

  const totalLikes = useMemo(
    () => allProjects.reduce((sum, p) => sum + (p.project.likes?.length || 0), 0),
    [allProjects]
  );

  const visibleProjects = useMemo(() => {
    const filtered = allProjects.filter((p) => {
      if (projectFilter === "all") return true;
      return p.source === projectFilter;
    });
    const getRecency = (p: DisplayProject) => {
      const v = p.project.startDate || p.project.createdAt;
      return v ? new Date(v).getTime() : 0;
    };
    const sorted = [...filtered].sort((a, b) => {
      if (projectSort === "liked") {
        return (b.project.likes?.length || 0) - (a.project.likes?.length || 0);
      }
      return getRecency(b) - getRecency(a);
    });
    return sorted;
  }, [allProjects, projectFilter, projectSort]);

  if (loading) {
    return (
      <div
        className={`flex justify-center items-center min-h-screen ${
          isDarkMode ? "bg-gray-900" : "bg-[#E5E5E5]"
        }`}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" role="status" aria-live="polite"></div>
        <span className={isDarkMode ? "text-gray-200 ml-3" : "text-gray-800 ml-3"}>Loading...</span>
      </div>
    );
  }

  if (!hacker) {
    return (
      <div
        className={`min-h-screen py-20 ${
          isDarkMode ? "bg-gray-900" : "bg-[#E5E5E5]"
        } flex items-center justify-center`}
      >
        <div
          className={`${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } p-8 rounded-lg shadow-lg`}
        >
          <h1
            className={`text-2xl font-bold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            } mb-2 font-space-mono`}
          >
            Profile Not Found
          </h1>
          <p
            className={`${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            } font-fira-code`}
          >
            The requested profile could not be found.
          </p>
        </div>
      </div>
    );
  }

  const filterButton = (value: ProjectFilter, label: string) => {
    const active = projectFilter === value;
    return (
      <button
        key={value}
        onClick={() => setProjectFilter(value)}
        className={`px-3 py-1.5 rounded-full text-sm font-fira-code transition-colors ${
          active
            ? "bg-indigo-600 text-white"
            : isDarkMode
            ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`min-h-screen py-20 ${
        isDarkMode ? "bg-gradient-to-b from-gray-900 to-black" : "bg-[#E5E5E5]"
      } font-space-mono`}
    >
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <div
          className={`${
            isDarkMode ? "bg-gray-800" : "bg-white"
          } rounded-xl shadow-lg overflow-hidden mb-8`}
        >
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 sm:h-48"></div>
          <div className="px-4 sm:px-8 pb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 sm:-mt-24 mb-4 sm:mb-8">
              <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
                <AvatarImage src={hacker.avatar?.url || null} alt={swapFirstLetters(hacker.name)} size={192} />
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left flex-grow">
                <div className="flex justify-between items-start">
                  <h1
                    className={`text-3xl font-bold ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    {swapFirstLetters(hacker.name)}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      aria-label="Edit profile"
                      className="p-2 text-gray-600 hover:text-gray-800"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                {hacker.bio && (
                  <p
                    className={`mt-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    } max-w-2xl font-fira-code`}
                  >
                    {hacker.bio.length > 100
                      ? `${hacker.bio.substring(0, 100)}...`
                      : hacker.bio}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-fira-code ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-100"
                        : "bg-pink-50 text-pink-700"
                    }`}
                    aria-label="Total likes across all projects"
                  >
                    <HeartIcon className="h-4 w-4 text-pink-500" />
                    <span>
                      <span className="font-semibold">{totalLikes}</span>{" "}
                      total {totalLikes === 1 ? "like" : "likes"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="space-y-8">
          <div className="mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Projects
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {filterButton("all", "All")}
                {filterButton("led", "Led")}
                {filterButton("contributed", "Contributed")}
                <select
                  value={projectSort}
                  onChange={(e) =>
                    setProjectSort(e.target.value as ProjectSort)
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-fira-code border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-700"
                  }`}
                  aria-label="Sort projects"
                >
                  <option value="recent">Most Recent</option>
                  <option value="liked">Most Liked</option>
                </select>
              </div>
            </div>

            {visibleProjects.length === 0 ? (
              <div
                className={`text-center py-12 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } rounded-lg shadow`}
              >
                <p
                  className={`${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  } font-fira-code`}
                >
                  No projects to show
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleProjects.map(({ project, source, role }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={`${
                      isDarkMode ? "bg-gray-800" : "bg-white"
                    } rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden`}
                  >
                    <div className="relative h-48">
                      <NextImage
                        src={
                          project.thumbnail?.url ||
                          (isDarkMode
                            ? "/images/default_project_thumbnail_dark.svg"
                            : "/images/default_project_thumbnail_light.svg")
                        }
                        alt={project.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-full">
                        <HeartIcon className="h-4 w-4 text-white" />
                        <span className="text-white text-sm">
                          {project.likes?.length || 0}
                        </span>
                      </div>
                      <div
                        className={`absolute top-2 right-2 px-2 py-1 ${getStatusBadgeClasses(
                          project.status
                        )} text-white text-sm rounded-full`}
                      >
                        {project.status.charAt(0) +
                          project.status.slice(1).toLowerCase()}
                      </div>
                      <div
                        className={`absolute bottom-2 left-2 px-2 py-1 text-white text-sm rounded-full ${
                          source === "led" ? "bg-purple-600" : "bg-indigo-600"
                        }`}
                      >
                        {source === "led" ? "Lead" : role}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3
                        className={`text-xl font-semibold ${
                          isDarkMode ? "text-gray-100" : "text-gray-900"
                        } mb-2`}
                      >
                        {project.title}
                      </h3>
                      <p
                        className={`${
                          isDarkMode ? "text-gray-300" : "text-gray-600"
                        } line-clamp-2 font-fira-code`}
                      >
                        {project.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          onClick={() => setIsEditing(false)}
        >
          <div
            className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`sticky top-0 flex items-center justify-between px-6 py-4 border-b ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <h2
                className={`text-xl font-bold ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                aria-label="Close"
                className={`p-1 rounded-full ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-4 space-y-4">
              {(() => {
                const fieldClasses = `w-full px-3 py-2 border rounded-lg ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`;
                const labelClasses = `block text-xs font-fira-code mb-1 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`;
                const fields: Array<{
                  key: keyof EditableFields;
                  label: string;
                  type?: string;
                  textarea?: boolean;
                  placeholder?: string;
                }> = [
                  { key: "name", label: "Name" },
                  { key: "username", label: "Username" },
                  { key: "bio", label: "Bio", textarea: true },
                  { key: "githubUrl", label: "GitHub URL", type: "url" },
                  { key: "linkedinUrl", label: "LinkedIn URL", type: "url" },
                  { key: "twitterUrl", label: "Twitter URL", type: "url" },
                  {
                    key: "discordName",
                    label: "Discord Handle",
                    placeholder: "Discord Handle (e.g. @username)",
                  },
                  { key: "websiteUrl", label: "Website URL", type: "url" },
                  { key: "phoneNumber", label: "Phone Number", type: "tel" },
                ];
                return fields.map(
                  ({ key, label, type = "text", textarea, placeholder }) => {
                    const value = editForm[key];
                    return (
                      <div key={key}>
                        <label htmlFor={`profile-${key}`} className={labelClasses}>
                          {label}
                        </label>
                        {textarea ? (
                          <textarea
                            id={`profile-${key}`}
                            value={value}
                            onChange={(e) =>
                              setEditForm({ ...editForm, [key]: e.target.value })
                            }
                            className={fieldClasses}
                            placeholder={placeholder ?? label}
                            rows={3}
                          />
                        ) : (
                          <input
                            id={`profile-${key}`}
                            type={type}
                            value={value}
                            onChange={(e) =>
                              setEditForm({ ...editForm, [key]: e.target.value })
                            }
                            className={fieldClasses}
                            placeholder={placeholder ?? label}
                          />
                        )}
                      </div>
                    );
                  }
                );
              })()}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
