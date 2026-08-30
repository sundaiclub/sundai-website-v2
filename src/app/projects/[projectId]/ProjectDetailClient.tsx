'use client';
import { memo, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import { useUserContext } from '../../contexts/UserContext';
import { HeartIcon } from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  ShareIcon,
} from '@heroicons/react/24/solid';
import { useTheme } from '../../contexts/ThemeContext';
import { useAutoLike } from '../../hooks/useAutoLike';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import type { Project } from '@/types/project';
import { swapFirstLetters } from '../../utils/nameUtils';
import ShareModal from '../../components/ShareModal';
import ProjectMarkdown from '../../components/ProjectMarkdown';
import {
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';

type RawProjectTag = Project['techTags'][number] | string;
type RawProjectParticipant =
  | Project['participants'][number]
  | {
      id: string;
      name: string;
      role?: string | null;
    };
type RawProject = Omit<
  Project,
  'thumbnail' | 'techTags' | 'domainTags' | 'participants'
> & {
  thumbnail?: Project['thumbnail'] | string;
  techTags?: RawProjectTag[];
  domainTags?: RawProjectTag[];
  participants?: RawProjectParticipant[];
};

function normalizeTag(tag: RawProjectTag): Project['techTags'][number] {
  return typeof tag === 'string' ? { id: tag, name: tag } : tag;
}

function normalizeParticipant(
  participant: RawProjectParticipant
): Project['participants'][number] {
  if ('hacker' in participant) return participant;

  return {
    role: participant.role || 'hacker',
    hacker: {
      id: participant.id,
      name: participant.name,
      avatar: null,
    },
  };
}

function isClerkAvatar(url: string | null) {
  if (!url) return false;

  try {
    return new URL(url).host.includes('clerk');
  } catch {
    return url.includes('clerk');
  }
}

const AvatarImage = memo(function AvatarImage({
  src,
  alt,
  size,
}: {
  src: string | null;
  alt: string;
  size: number;
}) {
  const defaultSrc = '/images/default_avatar.png';
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
        if (typeof window !== 'undefined' && window.Image) {
          const preloader = new window.Image();
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
});

export default function ProjectDetailClient() {
  const params = (useParams() || {}) as { projectId?: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userInfo } = useUserContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { isDarkMode } = useTheme();
  const managementClasses = useManagementClasses();
  const [isProjectDraft, setIsProjectDraft] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  useAutoLike(project?.id || null);

  const allowedEdit =
    !!project &&
    ((Array.isArray(project.participants) &&
      project.participants.some(
        participant => participant?.hacker?.id === userInfo?.id
      )) ||
      project?.launchLead?.id === userInfo?.id ||
      userInfo?.role === 'SITE_ADMIN');

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params?.projectId}`);
        if (!response.ok) {
          throw new Error('Project not found');
        }
        const data = (await response.json()) as RawProject;
        const normalized: Project = {
          ...data,
          thumbnail:
            typeof data.thumbnail === 'string'
              ? { url: data.thumbnail }
              : data.thumbnail,
          techTags: Array.isArray(data.techTags)
            ? data.techTags.map(normalizeTag)
            : [],
          domainTags: Array.isArray(data.domainTags)
            ? data.domainTags.map(normalizeTag)
            : [],
          participants: Array.isArray(data.participants)
            ? data.participants.map(normalizeParticipant)
            : [],
        };
        setProject(normalized);
      } catch (error) {
        console.error('Error fetching project:', error);
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    };

    if (params?.projectId) {
      fetchProject();
    }
  }, [params?.projectId, router]);

  useEffect(() => {
    if (project) {
      const likesArray = Array.isArray(project.likes) ? project.likes : [];
      setLikeCount(likesArray.length);
      if (userInfo) {
        setIsLiked(likesArray.some(like => like.hackerId === userInfo.id));
      } else {
        setIsLiked(false);
      }
    }
  }, [project, userInfo]);

  useEffect(() => {
    if (project) {
      setIsProjectDraft(project.status === 'DRAFT');
    }
  }, [project]);

  const handleLike = async () => {
    if (!userInfo) {
      alert('Please sign in to like projects');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project?.id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  useEffect(() => {
    if (!loading && project && userInfo && searchParams?.get('like') === '1') {
      const alreadyLiked = isLiked;
      if (!alreadyLiked) {
        (async () => {
          try {
            const response = await fetch(`/api/projects/${project.id}/like`, {
              method: 'POST',
            });
            if (response.ok) {
              setIsLiked(true);
              setLikeCount(prev => prev + 1);
            }
          } catch (e) {
            console.error('Auto-like failed', e);
          }
        })();
      }
    }
  }, [loading, project, userInfo, isLiked, searchParams]);

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/projects/${project?.id}/submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to submit project');
      }

      setIsProjectDraft(false);
      toast.success(
        'Project submitted successfully. Now it is visible to the public.'
      );
    } catch (error) {
      console.error('Error submitting project:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit project'
      );
    }
  };

  const handleDelist = async () => {
    try {
      const response = await fetch(`/api/projects/${project?.id}/submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'DRAFT' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delist project');
      }

      setIsProjectDraft(true);
      toast.success(
        'Project delisted successfully. Now it is hidden from the public.'
      );
    } catch (error) {
      console.error('Error delisting project:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delist project'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
            isDarkMode ? 'border-purple-400' : 'border-indigo-600'
          }`}
          role="status"
          aria-live="polite"
        ></div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <ManagementPage maxWidth="max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ManagementLinkButton href="/projects" variant="ghost">
          <span aria-hidden="true">&larr;</span>
          Back to projects
        </ManagementLinkButton>
        {allowedEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              className={managementClasses.secondaryButton}
              onClick={() => router.push(`/projects/${project.id}/edit`)}
              type="button"
            >
              Edit project
            </button>
            {isProjectDraft ? (
              <button
                className={managementClasses.primaryButton}
                onClick={handleSubmit}
                type="button"
              >
                Submit <CheckIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                className={managementClasses.secondaryButton}
                onClick={handleDelist}
                type="button"
              >
                Delist <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
        <article className={`${managementClasses.panel} overflow-hidden`}>
          <div className="relative aspect-[3/2] w-full overflow-hidden bg-black">
            <NextImage
              src={
                project.thumbnail?.url ||
                (isDarkMode
                  ? '/images/default_project_thumbnail_dark.svg'
                  : '/images/default_project_thumbnail_light.svg')
              }
              alt={project.title}
              fill
              className="object-contain"
              priority
              sizes="(min-width: 1024px) 384px, 100vw"
            />
          </div>
          <div className="p-5 sm:p-6">
            <p
              className={`text-xs font-bold uppercase tracking-[0.18em] ${managementClasses.mutedText}`}
            >
              Started {new Date(project.startDate).toLocaleDateString()}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
              {project.title}
            </h1>
            <ProjectMarkdown
              markdown={project.preview}
              className={`prose prose-sm mt-4 max-w-none ${
                isDarkMode
                  ? 'prose-invert prose-a:text-indigo-400'
                  : 'prose-gray prose-a:text-indigo-600'
              }`}
            />
            <div
              className={`mt-5 flex flex-wrap gap-2 border-t pt-5 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
            >
              <button
                onClick={handleLike}
                aria-label={`Likes ${likeCount}`}
                className={managementClasses.secondaryButton}
                type="button"
              >
                {isLiked ? (
                  <HeartIconSolid className="h-5 w-5 text-red-500" />
                ) : (
                  <HeartIcon className="h-5 w-5" />
                )}
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </button>
              {project.demoUrl && (
                <a
                  className={managementClasses.primaryButton}
                  href={project.demoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  View demo
                </a>
              )}
              {project.githubUrl && (
                <a
                  className={managementClasses.secondaryButton}
                  href={project.githubUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  GitHub
                </a>
              )}
              {project.blogUrl && (
                <a
                  className={managementClasses.secondaryButton}
                  href={project.blogUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Blog post
                </a>
              )}
              <button
                className={managementClasses.secondaryButton}
                onClick={() => setShowShareModal(true)}
                type="button"
              >
                <ShareIcon className="h-5 w-5" />
                Share
              </button>
            </div>
          </div>
        </article>

        <ManagementSection title="Team" size="large">
          <div className="grid gap-6">
            {project.launchLead?.id && (
              <div>
                <h3
                  className={`mb-3 text-xs font-bold uppercase tracking-wide ${managementClasses.mutedText}`}
                >
                  Launch lead
                </h3>
                <Link
                  className={`${managementClasses.subtlePanel} flex items-center gap-3 p-3 transition ${isDarkMode ? 'hover:brightness-110' : 'hover:brightness-95'}`}
                  href={`/hacker/${project.launchLead.id}`}
                >
                  <AvatarImage
                    src={project.launchLead.avatar?.url || null}
                    alt={project.launchLead.name}
                    size={48}
                  />
                  <div className="min-w-0">
                    <h4 className="truncate font-semibold">
                      {swapFirstLetters(project.launchLead.name)}
                    </h4>
                    <p className={`text-sm ${managementClasses.mutedText}`}>
                      Launch lead
                    </p>
                  </div>
                </Link>
              </div>
            )}

            <div>
              <h3
                className={`mb-3 text-xs font-bold uppercase tracking-wide ${managementClasses.mutedText}`}
              >
                Team members
              </h3>
              {project.participants.length > 0 ? (
                <div className="grid gap-2">
                  {project.participants.map(participant => (
                    <Link
                      key={participant.hacker.id}
                      className={`${managementClasses.subtlePanel} flex items-center gap-3 p-3 transition ${isDarkMode ? 'hover:brightness-110' : 'hover:brightness-95'}`}
                      href={`/hacker/${participant.hacker.id}`}
                    >
                      <AvatarImage
                        src={participant.hacker.avatar?.url || null}
                        alt={swapFirstLetters(participant.hacker.name)}
                        size={48}
                      />
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold">
                          {swapFirstLetters(participant.hacker.name)}
                        </h4>
                        <p className={`text-sm ${managementClasses.mutedText}`}>
                          {participant.role === 'hacker'
                            ? 'Builder'
                            : participant.role}
                        </p>
                        {participant.hacker.bio && (
                          <p
                            className={`mt-1 line-clamp-2 text-xs ${managementClasses.mutedText}`}
                          >
                            {participant.hacker.bio}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${managementClasses.mutedText}`}>
                  No team members are listed.
                </p>
              )}
            </div>
          </div>
        </ManagementSection>
      </div>

      <div className="mt-6">
        <ManagementSection title="About this project" size="large">
          {(project.techTags.length > 0 || project.domainTags.length > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {[...project.techTags, ...project.domainTags].map(
                (tag, index) => (
                  <span
                    key={`${tag.id}-${index}`}
                    className={`${managementClasses.subtlePanel} rounded-full px-3 py-1 text-xs font-semibold`}
                  >
                    {tag.name}
                  </span>
                )
              )}
            </div>
          )}
          <ProjectMarkdown
            markdown={project.description}
            className={`prose prose-lg max-w-none ${
              isDarkMode
                ? 'prose-invert prose-pre:bg-gray-800 prose-a:text-indigo-400 hover:prose-a:text-indigo-300'
                : 'prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600 hover:prose-a:text-indigo-700'
            }`}
          />
        </ManagementSection>
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
    </ManagementPage>
  );
}
