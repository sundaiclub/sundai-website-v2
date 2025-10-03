"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NextImage from "next/image";
import Link from "next/link";
import { useUserContext } from "../../contexts/UserContext";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid, ShareIcon } from "@heroicons/react/24/solid";
import { useTheme } from "../../contexts/ThemeContext";
import { useAutoLike } from "../../hooks/useAutoLike";
import ReactMarkdown from 'react-markdown';
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import toast from 'react-hot-toast';
import { Project } from "../../components/Project";
import { swapFirstLetters } from "../../utils/nameUtils";
import ShareModal from "../../components/ShareModal";

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const { userInfo } = useUserContext();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { isDarkMode } = useTheme();
  const [isProjectDraft, setIsProjectDraft] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  useAutoLike(project?.id || null);

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
          if (GlobalImage) {
            const preloader = new GlobalImage();
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
      <NextImage
        src={imgSrc}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover"
        unoptimized
        onError={() => {
          if (imgSrc !== defaultSrc) {
            setImgSrc(defaultSrc);
          }
        }}
      />
    );
  };

  const allowedEdit = !!project && (
    (Array.isArray(project.participants) && project.participants.some(
      (participant) => participant?.hacker?.id === userInfo?.id
    )) || project?.launchLead?.id === userInfo?.id || userInfo?.role === 'ADMIN'
  );

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params.projectId}`);
        if (!response.ok) {
          throw new Error("Project not found");
        }
        const data = await response.json();
        const normalized = {
          ...data,
          thumbnail: (data as any).thumbnail?.url ? (data as any).thumbnail : (typeof (data as any).thumbnail === 'string' ? { url: (data as any).thumbnail } : (data as any).thumbnail),
          techTags: Array.isArray((data as any).techTags) ? (data as any).techTags.map((t: any) => (typeof t === 'string' ? { id: t, name: t } : t)) : [],
          domainTags: Array.isArray((data as any).domainTags) ? (data as any).domainTags.map((t: any) => (typeof t === 'string' ? { id: t, name: t } : t)) : [],
          participants: Array.isArray((data as any).participants) ? (data as any).participants.map((p: any) => (p?.hacker ? p : { hacker: { id: p.id, name: p.name, avatar: null }, role: (p.role || 'hacker') })) : [],
        } as any;
        setProject(normalized);
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
    if (project) {
      const likesArray = Array.isArray((project as any).likes) ? (project as any).likes : [];
      setLikeCount(likesArray.length);
      if (userInfo) {
        setIsLiked(likesArray.some((like: any) => like.hackerId === userInfo.id));
      } else {
        setIsLiked(false);
      }
    }
  }, [project, userInfo]);

  useEffect(() => {
    if (project) {
      setIsProjectDraft(project.status === "DRAFT");
    }
  }, [project]);

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

  useEffect(() => {
    // Auto-like when coming from email with like=1
    if (!loading && project && userInfo && searchParams?.get('like') === '1') {
      const alreadyLiked = isLiked;
      if (!alreadyLiked) {
        (async () => {
          try {
            const response = await fetch(`/api/projects/${project.id}/like`, { method: 'POST' });
            if (response.ok) {
              setIsLiked(true);
              setLikeCount((prev) => prev + 1);
            }
          } catch (e) {
            console.error('Auto-like failed', e);
          }
        })();
      }
    }
  }, [loading, project, userInfo, isLiked]);

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/projects/${project?.id}/submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to submit project');
      }

      setIsProjectDraft(false);
      toast.success('Project submitted successfully. Now it is visible to the public.');
    } catch (error) {
      console.error('Error submitting project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit project');
    }
  };

  const handleDelist = async () => {
    try {
      const response = await fetch(`/api/projects/${project?.id}/submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'DRAFT' })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delist project');
      }

      setIsProjectDraft(true);
      toast.success('Project delisted successfully. Now it is hidden from the public.');
    } catch (error) {
      console.error('Error delisting project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delist project');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
            isDarkMode ? "border-purple-400" : "border-indigo-600"
          }`} role="status" aria-live="polite"
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
      <div className="max-w-7xl mx-auto relative">
        <div className={`shadow-lg overflow-hidden`}>
          {/* Project Header - Now with larger height on desktop */}
          <div className="relative h-64 md:h-96 w-full">
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
              priority
            />
            {allowedEdit && (
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                  onClick={() => router.push(`/projects/${project.id}/edit`)}
                  className={`text-sm px-6 py-3 transition-colors backdrop-blur-sm
                    ${isDarkMode 
                      ? 'bg-white/20 text-white hover:bg-white/30' 
                      : 'bg-white/20 text-white hover:bg-black/30'
                    } font-medium`}
                >
                  Edit Project
                </button>
                {isProjectDraft && (
                  <button
                    onClick={handleSubmit}
                    className={`text-sm px-6 py-3 transition-colors backdrop-blur-sm flex items-center gap-2
                      bg-green-500/50 hover:bg-green-300/50 text-white cursor-pointer font-medium`}
                  >
                    Submit <CheckIcon className="h-5 w-5" />
                  </button>
                )}
                {!isProjectDraft && (
                  <button
                    onClick={handleDelist}
                    className={`text-sm px-6 py-3 transition-colors backdrop-blur-sm flex items-center gap-2
                        bg-red-500/50 hover:bg-red-300/50 text-white cursor-pointer font-medium`}
                  >
                    Delist <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 p-6 md:p-10 text-white w-full">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between max-w-6xl mx-auto">
                <div className="mb-4 md:mb-0">
                  <h1 className="text-3xl md:text-5xl font-bold mb-4">
                    {project.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* <span
                      className={`px-4 py-1.5 rounded-full text-sm md:text-base ${
                        project.status === "APPROVED"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {project.status}
                    </span> */}
                    <span className="text-sm md:text-base">
                      Started {new Date(project.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm md:text-base font-medium text-gray-300">
                      {project.preview}
                    </span>
                  </div>
                </div>
                <div className="mt-4 md:mt-0">
                  <button
                    onClick={handleLike}
                    aria-label={`Likes ${likeCount}`}
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
                        GitHub
                      </Link>
                    )}
                    {project.blogUrl && (
                      <Link
                        href={project.blogUrl}
                        className={`px-6 py-3 rounded-lg transition-colors ${
                          isDarkMode
                            ? "bg-gray-700 hover:bg-gray-600"
                            : "bg-gray-800 hover:bg-gray-900"
                        } text-white text-lg`}
                        target="_blank"
                      >
                        Blogpost
                      </Link>
                    )}
                    <button
                      onClick={() => setShowShareModal(true)}
                      className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                        isDarkMode
                          ? "bg-green-700 hover:bg-green-600"
                          : "bg-green-600 hover:bg-green-700"
                      } text-white text-lg`}
                    >
                      <ShareIcon className="h-5 w-5" />
                      Share
                    </button>
                  </div>
                  
                  {/* Tags Section */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.techTags?.map((tag) => (
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
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.domainTags?.map((tag) => (
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

                  <div className="prose prose-lg max-w-none mb-8">
                    <ReactMarkdown
                      className={`prose prose-lg max-w-none mb-8 ${
                        isDarkMode 
                          ? 'prose-invert prose-pre:bg-gray-800 prose-a:text-indigo-400 hover:prose-a:text-indigo-300' 
                          : 'prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600 hover:prose-a:text-indigo-700'
                      }`}
                    >
                      {project.description}
                    </ReactMarkdown>
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
                    {project.launchLead?.id && (
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
                            <AvatarImage src={project.launchLead.avatar?.url || null} alt={project.launchLead.name} size={48} />
                          </div>
                          <div className="ml-4">
                            <h4
                              className={`text-lg font-semibold ${
                                isDarkMode ? "text-gray-100" : "text-gray-900"
                              }`}
                            >
                              {swapFirstLetters(project.launchLead.name)}
                            </h4>
                            <p className="text-sm text-indigo-600">
                              Launch Lead
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>
                    )}

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
                                <AvatarImage src={participant.hacker.avatar?.url || null} alt={swapFirstLetters(participant.hacker.name)} size={48} />
                              </div>
                              <div className="ml-4">
                                <h4
                                  className={`text-lg font-semibold ${
                                    isDarkMode
                                      ? "text-gray-100"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {swapFirstLetters(participant.hacker.name)}
                                </h4> 
                                <p
                                  className={`text-sm ${
                                    isDarkMode
                                      ? "text-indigo-400"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {participant.role === "hacker" ? "builder" : participant.role}
                                </p>
                                {participant.hacker.bio && (
                                  <p className={`text-sm mt-1 line-clamp-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                    {(participant.hacker as any).bio?.length > 50 
                                      ? `${(participant.hacker as any).bio.substring(0, 50)}...` 
                                      : (participant.hacker as any).bio}
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
      
      {/* Share Modal */}
      {project && (
        <ShareModal
          showModal={showShareModal}
          setShowModal={setShowShareModal}
          project={project}
          userInfo={userInfo}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
