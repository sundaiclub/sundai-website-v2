"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import NextImage from "next/image";
import Link from "next/link";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
import { PencilIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useTheme } from "../../contexts/ThemeContext";
import { swapFirstLetters } from "../../utils/nameUtils";

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
    likes: Array<{
      hackerId: string;
      createdAt: string;
    }>;
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

// Add this type for the edit form
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

// Add this helper function at the top of the file, after the types
const getStatusBadgeClasses = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-500';
    case 'PENDING':
      return 'bg-orange-500';
    case 'APPROVED':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
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
  const { isDarkMode } = useTheme();

  const AvatarImage = ({ src, alt, size }: { src: string | null; alt: string; size: number }) => {
    const defaultSrc = "/images/default_avatar.png";
    const isClerkAvatar = (u: string | null) => {
      if (!u) return false;
      try {
        const host = new URL(u).host;
        return host.includes("clerk");
      } catch {
        return u.includes("clerk");
      }
    };

    const [imgSrc, setImgSrc] = useState<string>(() => {
      if (!src) return defaultSrc;
      return isClerkAvatar(src) ? defaultSrc : src;
    });

    useEffect(() => {
      if (!src) {
        setImgSrc(defaultSrc);
        return;
      }
      if (isClerkAvatar(src)) {
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
      } else {
        setImgSrc(src);
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

  const isOwnProfile = currentUserHackerId === params.hackerId;

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/hackers/${params.hackerId}`, {
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
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) =>
                        setEditForm({ ...editForm, username: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Username"
                    />
                    <textarea
                      value={editForm.bio}
                      onChange={(e) =>
                        setEditForm({ ...editForm, bio: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Bio"
                      rows={3}
                    />
                    <input
                      type="url"
                      value={editForm.githubUrl}
                      onChange={(e) =>
                        setEditForm({ ...editForm, githubUrl: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="GitHub URL"
                    />
                    <input
                      type="url"
                      value={editForm.linkedinUrl}
                      onChange={(e) =>
                        setEditForm({ ...editForm, linkedinUrl: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="LinkedIn URL"
                    />
                    <input
                      type="url"
                      value={editForm.twitterUrl}
                      onChange={(e) =>
                        setEditForm({ ...editForm, twitterUrl: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Twitter URL"
                    />
                    <input
                      type="text"
                      value={editForm.discordName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, discordName: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Discord Handle (e.g. @username)"
                    />
                    <input
                      type="url"
                      value={editForm.websiteUrl}
                      onChange={(e) =>
                        setEditForm({ ...editForm, websiteUrl: e.target.value })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Website URL"
                    />
                    <input
                      type="tel"
                      value={editForm.phoneNumber}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          phoneNumber: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Phone Number"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-green-600 hover:text-green-800"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Contact & Links */}
            {/* {!isEditing && (
              <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                {hacker.githubUrl && (
                  <Link
                    href={hacker.githubUrl}
                    target="_blank"
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-gray-100 hover:bg-gray-200"
                    } rounded-full transition-colors`}
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
                {hacker.linkedinUrl && (
                  <Link
                    href={hacker.linkedinUrl}
                    target="_blank"
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-blue-100 hover:bg-blue-200"
                    } rounded-full transition-colors`}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                      />
                    </svg>
                    LinkedIn
                  </Link>
                )}
                {hacker.twitterUrl && (
                  <Link
                    href={hacker.twitterUrl}
                    target="_blank"
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-sky-100 hover:bg-sky-200"
                    } rounded-full transition-colors`}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
                      />
                    </svg>
                    Twitter
                  </Link>
                )}
                {hacker.email && (
                  <Link
                    href={`mailto:${hacker.email}`}
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                        : "bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                    } rounded-full transition-colors`}
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
                {hacker.discordName && (
                  <Link
                    href={`https://discord.com/users/${hacker.discordName}`}
                    target="_blank"
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-indigo-100 hover:bg-indigo-200"
                    } rounded-full transition-colors`}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"
                      />
                    </svg>
                    {hacker.discordName}
                  </Link>
                )}
                {hacker.websiteUrl && (
                  <Link
                    href={hacker.websiteUrl}
                    target="_blank"
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-purple-100 hover:bg-purple-200"
                    } rounded-full transition-colors`}
                  >
                    <svg 
                      className="w-5 h-5 mr-2" 
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
                      <path d="M3.6 9h16.8"/>
                      <path d="M3.6 15h16.8"/>
                      <path d="M12 3a15 15 0 0 1 0 18"/>
                      <path d="M12 3a15 15 0 0 0 0 18"/>
                    </svg>
                    Website
                  </Link>
                )}
              </div>
            )} */}
          </div>
        </div>

        {/* Projects Section */}
        <div className="space-y-8">
          {/* Led Projects */}
          {Array.isArray(hacker.ledProjects) &&
            hacker.ledProjects.length > 0 && (
              <div className="mb-12">
                <h2
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-gray-100" : "text-gray-900"
                  } mb-4`}
                >
                  Projects Led
                </h2>
                <div className={scrollableSection}>
                  {hacker.ledProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className={`flex-shrink-0 w-80 ${
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
                        <div className={`absolute top-2 right-2 px-2 py-1 ${getStatusBadgeClasses(project.status)} text-white text-sm rounded-full`}>
                          {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
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
              </div>
            )}

          {/* Participated Projects */}
          {Array.isArray(hacker.projects) && hacker.projects.length > 0 && (
            <div className="mb-12">
              <h2
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                } mb-4`}
              >
                Projects Contributed To
              </h2>
              <div className={scrollableSection}>
                {hacker.projects.map(({ project, role }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={`flex-shrink-0 w-80 ${
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
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-indigo-600 text-white text-sm rounded-full">
                        {role}
                      </div>
                      <div className={`absolute top-2 right-2 px-2 py-1 ${getStatusBadgeClasses(project.status)} text-white text-sm rounded-full`}>
                        {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
                      </div>
                      <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-full">
                        <HeartIcon className="h-4 w-4 text-white" />
                        <span className="text-white text-sm">
                          {project.likes?.length || 0}
                        </span>
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
            </div>
          )}

          {/* Liked Projects */}
          {Array.isArray(hacker.likedProjects) &&
            hacker.likedProjects.length > 0 && (
              <div className="mb-12">
                <h2
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-gray-100" : "text-gray-900"
                  } mb-4`}
                >
                  Liked Projects
                </h2>
                <div className={scrollableSection}>
                  {hacker.likedProjects.map(({ project, createdAt }) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className={`flex-shrink-0 w-80 ${
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
                        <div className="absolute bottom-2 left-2 flex items-center space-x-2 bg-black/50 px-3 py-1 rounded-full">
                          <AvatarImage src={project.launchLead.avatar?.url || null} alt={project.launchLead.name} size={20} />
                          <span className="text-white text-sm">
                            {project.launchLead.name}
                          </span>
                        </div>
                        <div className={`absolute top-2 right-2 px-2 py-1 ${getStatusBadgeClasses(project.status)} text-white text-sm rounded-full`}>
                          {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3
                            className={`text-xl font-semibold ${
                              isDarkMode ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {project.title}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {new Date(createdAt).toLocaleDateString()}
                          </span>
                        </div>
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
              </div>
            )}

          {(!Array.isArray(hacker.projects) || hacker.projects.length === 0) &&
            (!Array.isArray(hacker.ledProjects) ||
              hacker.ledProjects.length === 0) && (
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
                  No projects yet
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
