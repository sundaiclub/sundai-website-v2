"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import NextImage from "next/image";
import Link from "next/link";
import { HeartIcon, StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import {
  PencilIcon,
  XMarkIcon,
  CameraIcon,
  StarIcon as StarIconOutline,
} from "@heroicons/react/24/outline";
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
  featuredProjectIds: string[];
};

const MAX_FEATURED = 3;

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
          featuredProjectIds: data.featuredProjectIds || [],
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

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be smaller than 5MB");
      return;
    }

    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/hackers/${params?.hackerId}/avatar`,
        { method: "POST", body: formData }
      );
      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }
      const updated = await response.json();
      setHacker((prev) => (prev ? { ...prev, avatar: updated.avatar } : prev));
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

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

  const totalProjectCount = allProjects.length;
  const ledProjectCount = useMemo(
    () => allProjects.filter((p) => p.source === "led").length,
    [allProjects]
  );

  const featuredProjects = useMemo(() => {
    if (!hacker) return [] as DisplayProject[];
    const ids = hacker.featuredProjectIds || [];
    const byId = new Map(allProjects.map((p) => [p.project.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is DisplayProject => Boolean(p));
  }, [hacker, allProjects]);

  const toggleFeatured = async (projectId: string) => {
    if (!hacker || !isOwnProfile) return;
    const current = hacker.featuredProjectIds || [];
    const isCurrentlyFeatured = current.includes(projectId);
    let next: string[];
    if (isCurrentlyFeatured) {
      next = current.filter((id) => id !== projectId);
    } else {
      if (current.length >= MAX_FEATURED) return;
      next = [...current, projectId];
    }

    const previous = current;
    setHacker((prev) => (prev ? { ...prev, featuredProjectIds: next } : prev));
    try {
      const response = await fetch(
        `/api/hackers/${params?.hackerId}/featured-projects`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featuredProjectIds: next }),
        }
      );
      if (!response.ok) throw new Error("Failed to update featured projects");
    } catch (error) {
      console.error(error);
      setHacker((prev) =>
        prev ? { ...prev, featuredProjectIds: previous } : prev
      );
    }
  };

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

  const renderSocialLinks = () => {
    const iconClass = "h-4 w-4";
    const linkClass = `inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
      isDarkMode
        ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`;
    const items: Array<{ key: string; node: React.ReactNode } | null> = [];

    if (hacker.githubUrl) {
      items.push({
        key: "github",
        node: (
          <a
            key="github"
            href={hacker.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className={linkClass}
          >
            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.35.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.95 10.95 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.81-.01 3.19 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.73 18.27.5 12 .5z" />
            </svg>
          </a>
        ),
      });
    }
    if (hacker.linkedinUrl) {
      items.push({
        key: "linkedin",
        node: (
          <a
            key="linkedin"
            href={hacker.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            title="LinkedIn"
            className={linkClass}
          >
            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
            </svg>
          </a>
        ),
      });
    }
    if (hacker.twitterUrl) {
      items.push({
        key: "twitter",
        node: (
          <a
            key="twitter"
            href={hacker.twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter / X"
            title="Twitter / X"
            className={linkClass}
          >
            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
            </svg>
          </a>
        ),
      });
    }
    if (hacker.websiteUrl) {
      items.push({
        key: "website",
        node: (
          <a
            key="website"
            href={hacker.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
            title="Website"
            className={linkClass}
          >
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 0 20" />
              <path d="M12 2a15.3 15.3 0 0 0 0 20" />
            </svg>
          </a>
        ),
      });
    }
    if (hacker.discordName) {
      items.push({
        key: "discord",
        node: (
          <span
            key="discord"
            aria-label={`Discord: ${hacker.discordName}`}
            title={`Discord: ${hacker.discordName}`}
            className={`inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md text-sm font-fira-code ${
              isDarkMode
                ? "bg-gray-700 text-gray-200"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.077.077 0 0 0-.082.038c-.357.636-.752 1.464-1.029 2.114a18.27 18.27 0 0 0-5.487 0 12.57 12.57 0 0 0-1.045-2.114.08.08 0 0 0-.082-.038A19.736 19.736 0 0 0 5.07 4.369a.069.069 0 0 0-.032.027C1.42 9.737.508 14.945.97 20.082a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.029.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.106c.36.699.772 1.364 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.029.077.077 0 0 0 .032-.054c.5-5.94-.838-11.105-3.549-15.687a.061.061 0 0 0-.031-.028zM8.02 16.96c-1.183 0-2.157-1.087-2.157-2.421 0-1.334.955-2.421 2.157-2.421 1.21 0 2.176 1.096 2.157 2.421 0 1.334-.955 2.421-2.157 2.421zm7.974 0c-1.183 0-2.157-1.087-2.157-2.421 0-1.334.955-2.421 2.157-2.421 1.21 0 2.176 1.096 2.157 2.421 0 1.334-.946 2.421-2.157 2.421z" />
            </svg>
            <span className="truncate max-w-[12rem]">{hacker.discordName}</span>
          </span>
        ),
      });
    }

    if (items.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
        {items.map((item) => item!.node)}
      </div>
    );
  };

  const filterButton = (value: ProjectFilter, label: string) => {
    const active = projectFilter === value;
    return (
      <button
        key={value}
        onClick={() => setProjectFilter(value)}
        className={`px-3 py-1.5 rounded-md text-sm font-fira-code transition-colors ${
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

  const renderProjectCard = ({ project }: DisplayProject) => {
    const isFeatured = (hacker?.featuredProjectIds || []).includes(project.id);
    const canFeatureMore =
      (hacker?.featuredProjectIds || []).length < MAX_FEATURED;
    const starDisabled = !isFeatured && !canFeatureMore;
    return (
      <div
        key={project.id}
        className={`relative ${
          isDarkMode ? "bg-gray-800" : "bg-white"
        } rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden`}
      >
        <Link href={`/projects/${project.id}`} className="block">
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
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-md">
              <HeartIcon className="h-4 w-4 text-white" />
              <span className="text-white text-sm">
                {project.likes?.length || 0}
              </span>
            </div>
            {isOwnProfile && (
              <div
                className={`absolute top-2 right-2 px-2 py-1 ${getStatusBadgeClasses(
                  project.status
                )} text-white text-sm rounded-md`}
              >
                {project.status.charAt(0) +
                  project.status.slice(1).toLowerCase()}
              </div>
            )}
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
        {isOwnProfile && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!starDisabled) toggleFeatured(project.id);
            }}
            disabled={starDisabled}
            aria-label={
              isFeatured
                ? "Unfeature project"
                : starDisabled
                ? `Featured limit reached (${MAX_FEATURED})`
                : "Feature project"
            }
            title={
              isFeatured
                ? "Unfeature"
                : starDisabled
                ? `You can feature up to ${MAX_FEATURED} projects`
                : "Feature on profile"
            }
            className={`absolute bottom-2 right-2 p-1.5 rounded-md shadow ${
              isFeatured
                ? "bg-yellow-400 text-white hover:bg-yellow-500"
                : isDarkMode
                ? "bg-gray-900/70 text-gray-200 hover:bg-gray-900"
                : "bg-white/90 text-gray-700 hover:bg-white"
            } ${starDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isFeatured ? (
              <StarIconSolid className="h-4 w-4" />
            ) : (
              <StarIconOutline className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
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
          <div className="px-4 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div
                className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-white shadow-md flex-shrink-0 ${
                  isDarkMode ? "ring-1 ring-gray-700" : "ring-1 ring-gray-200"
                }`}
              >
                <AvatarImage
                  src={hacker.avatar?.url || null}
                  alt={swapFirstLetters(hacker.name)}
                  size={160}
                />
                {isOwnProfile && (
                  <label
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Change profile picture"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    {uploadingAvatar ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
                    ) : (
                      <div className="flex flex-col items-center text-white">
                        <CameraIcon className="h-8 w-8" />
                        <span className="text-xs mt-1 font-fira-code">Change</span>
                      </div>
                    )}
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left flex-grow w-full">
                <div className="flex justify-between items-start gap-2">
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
                      className={`p-2 ${
                        isDarkMode
                          ? "text-gray-400 hover:text-gray-200"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
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
                {avatarError && (
                  <p className="mt-2 text-sm text-red-500 font-fira-code">
                    {avatarError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-fira-code ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-100"
                        : "bg-indigo-50 text-indigo-700"
                    }`}
                    aria-label="Total projects"
                  >
                    <span>
                      <span className="font-semibold">{totalProjectCount}</span>{" "}
                      {totalProjectCount === 1 ? "project" : "projects"}
                    </span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-fira-code ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-100"
                        : "bg-purple-50 text-purple-700"
                    }`}
                    aria-label="Projects led"
                  >
                    <span>
                      <span className="font-semibold">{ledProjectCount}</span>{" "}
                      led
                    </span>
                  </div>
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
                {renderSocialLinks()}
              </div>
            </div>
          </div>
        </div>

        {/* Featured Projects Section */}
        {(featuredProjects.length > 0 || isOwnProfile) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2
                className={`text-2xl font-bold flex items-center gap-2 ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}
              >
                <StarIconSolid className="h-6 w-6 text-yellow-400" />
                Featured
              </h2>
              {isOwnProfile && (
                <span
                  className={`text-sm font-fira-code ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {featuredProjects.length}/{MAX_FEATURED}
                </span>
              )}
            </div>
            {featuredProjects.length === 0 ? (
              <div
                className={`text-center py-8 ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } rounded-lg shadow`}
              >
                <p
                  className={`${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  } font-fira-code text-sm`}
                >
                  Tap the star on any project below to feature it here (up to {MAX_FEATURED}).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredProjects.map((dp) => renderProjectCard(dp))}
              </div>
            )}
          </div>
        )}

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
                  className={`px-3 py-1.5 rounded-md text-sm font-fira-code border ${
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
                {visibleProjects.map((dp) => renderProjectCard(dp))}
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
