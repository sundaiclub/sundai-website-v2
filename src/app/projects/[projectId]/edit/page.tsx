'use client';
import React, { useRef, useState } from 'react';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  BoldIcon,
  ItalicIcon,
  PhotoIcon,
  LinkIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';

import { useTheme } from '../../../contexts/ThemeContext';
import { useUserContext } from '../../../contexts/UserContext';
import type { Project } from '@/types/project';
import PermissionDenied from '../../../components/PermissionDenied';
import TagSelector from '../../../components/TagSelector';
import {
  XMarkIcon,
  PlusIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  HackerSelector,
  ProjectRoles,
} from '../../../components/HackerSelector';
import type { HackerSelectionOption } from '@/types/hacker';
import { swapFirstLetters } from '../../../utils/nameUtils';
import ImageGenerationModal from '../../../components/ImageGenerationModal';
import ProjectMarkdown from '../../../components/ProjectMarkdown';
import {
  getImageUploadError,
  validateImageUploadSize,
} from '@/lib/imageUploads';

const MAX_TITLE_LENGTH = 32;
const MAX_PREVIEW_LENGTH = 100;

type ProjectRouteParams = {
  projectId: string;
};

type AppRouter = ReturnType<typeof useRouter>;

type UploadImageResponse = {
  url: string;
};

type ProjectEventOption = {
  id: string;
  title: string;
  chapterName: string;
  image: { url: string; alt?: string | null } | null;
  selectedByDefault: boolean;
  alreadyAdded: boolean;
};

const uploadImage = async (file: File): Promise<string> => {
  const sizeError = validateImageUploadSize(file);
  if (sizeError) throw new Error(sizeError);

  const loadingToast = toast.loading('Uploading image...');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);

  try {
    const response = await fetch('/api/uploads/image', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(
        await getImageUploadError(response, 'Failed to upload image')
      );
    }
    const data = (await response.json()) as UploadImageResponse;
    return data.url;
  } finally {
    toast.dismiss(loadingToast);
  }
};

function ButtonPanel({
  params,
  router,
  isDarkMode,
  handleSave,
  handlePublish,
  saving,
  publishing,
  isDraft,
  contextual,
}: {
  params: ProjectRouteParams;
  router: AppRouter;
  isDarkMode: boolean;
  handleSave: () => void;
  handlePublish: () => void;
  saving: boolean;
  publishing: boolean;
  isDraft: boolean;
  contextual: boolean;
}) {
  return (
    <div className="flex items-center space-x-4 mt-4">
      <button
        onClick={() => router.push(`/projects/${params.projectId}`)}
        className={`flex items-center gap-2 px-4 py-2 transition-colors ${
          isDarkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
        } shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
      >
        <ArrowLeftIcon className="h-5 w-5" /> Back to Project
      </button>
      {!contextual && (
        <button
          onClick={handleSave}
          disabled={saving || publishing}
          className={`px-4 py-2 ${
            isDraft
              ? isDarkMode
                ? 'bg-gray-600 hover:bg-gray-500'
                : 'bg-gray-500 hover:bg-gray-600'
              : isDarkMode
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
          } text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <span>{isDraft ? 'Save Draft' : 'Save Changes'}</span>
          )}
        </button>
      )}
      {isDraft && (
        <button
          onClick={handlePublish}
          disabled={saving || publishing}
          className={`px-4 py-2 ${
            isDarkMode
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-green-600 hover:bg-green-700'
          } text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center space-x-2`}
        >
          {publishing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              <span>Publishing...</span>
            </>
          ) : (
            <span>Publish</span>
          )}
        </button>
      )}
    </div>
  );
}

function getImageNameFromUrl(url: string): string {
  try {
    const filename = url.split('/').pop() || '';
    return decodeURIComponent(filename.replace(/^[a-f0-9-]+-/, ''));
  } catch {
    return 'image';
  }
}

export default function ProjectEditPage() {
  const params = useParams<ProjectRouteParams>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contextualEventIds = searchParams.getAll('eventId');
  const contextualEventIdsKey = contextualEventIds.join(',');
  const sourceEventId = searchParams.get('sourceEventId');
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : null;
  const contextual = Boolean(sourceEventId);
  const [loading, setLoading] = useState(true);
  const { isAdmin, userInfo } = useUserContext();
  const { isDarkMode } = useTheme();
  const [project, setProject] = useState<Project | null>(null);
  const [eventOptions, setEventOptions] = useState<ProjectEventOption[]>([]);
  const [selectedEventIds, setSelectedEventIds] =
    useState<string[]>(contextualEventIds);
  const defaultEventImage = isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';

  const [editableTitle, setEditableTitle] = useState('');
  const [editablePreview, setEditablePreview] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [descriptionView, setDescriptionView] = useState<'write' | 'preview'>(
    'write'
  );
  const [editableStartDate, setEditableStartDate] = useState<Date>(new Date());
  const [editableGithubUrl, setEditableGithubUrl] = useState('');
  const [editableDemoUrl, setEditableDemoUrl] = useState('');
  const [editableBlogUrl, setEditableBlogUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [availableTechTags, setAvailableTechTags] = useState<
    Project['techTags']
  >([]);
  const [availableDomainTags, setAvailableDomainTags] = useState<
    Project['domainTags']
  >([]);
  const [showTechTagModal, setShowTechTagModal] = useState(false);
  const [showDomainTagModal, setShowDomainTagModal] = useState(false);

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailPrompt, setThumbnailPrompt] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const [hackers, setHackers] = useState<HackerSelectionOption[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showLaunchLeadModal, setShowLaunchLeadModal] = useState(false);
  const [showImageGenerationModal, setShowImageGenerationModal] =
    useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [leadSearchTerm, setLeadSearchTerm] = useState('');

  const filteredTeamHackers = hackers.filter(
    hacker =>
      hacker.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
      hacker.email?.toLowerCase().includes(teamSearchTerm.toLowerCase())
  );

  const filteredLeadHackers = hackers.filter(
    hacker =>
      hacker.name.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
      hacker.email?.toLowerCase().includes(leadSearchTerm.toLowerCase())
  );

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${params?.projectId}`);
        if (!response.ok) {
          throw new Error('Project not found');
        }
        const data = await response.json();
        setProject(data);
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
      setEditableTitle(project.title);
      setEditableDescription(project.description);
      setEditablePreview(project.preview);
      setEditableStartDate(
        project.startDate ? new Date(project.startDate) : new Date()
      );
      setEditableGithubUrl(project.githubUrl || '');
      setEditableDemoUrl(project.demoUrl || '');
      setEditableBlogUrl(project.blogUrl || '');
      setThumbnailPreview(project.thumbnail?.url || null);
      setThumbnailPrompt(project.thumbnail?.prompt || null);
    }
  }, [project]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [techResponse, domainResponse] = await Promise.all([
          fetch('/api/tags/tech'),
          fetch('/api/tags/domain'),
        ]);
        const techData = await techResponse.json();
        const domainData = await domainResponse.json();
        setAvailableTechTags(techData);
        setAvailableDomainTags(domainData);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    fetch('/api/hackers')
      .then(res => res.json())
      .then(data => setHackers(data))
      .catch(error => console.error('Error fetching hackers:', error));
  }, []);

  useEffect(() => {
    if (!params?.projectId) return;

    fetch(
      `/api/events/project-options?projectId=${encodeURIComponent(params.projectId)}`
    )
      .then(async response => {
        if (!response.ok) throw new Error('Failed to load current events');
        return response.json() as Promise<ProjectEventOption[]>;
      })
      .then(events => {
        setEventOptions(events);
        const contextualIds = new Set(
          contextualEventIdsKey ? contextualEventIdsKey.split(',') : []
        );
        setSelectedEventIds(
          Array.from(
            new Set([
              ...Array.from(contextualIds),
              ...events
                .filter(event => event.selectedByDefault)
                .map(event => event.id),
            ])
          )
        );
      })
      .catch(error => console.error('Error fetching current events:', error));
  }, [contextualEventIdsKey, params?.projectId]);

  const handleEventSelection = (eventId: string, selected: boolean) => {
    setSelectedEventIds(current =>
      selected
        ? Array.from(new Set([...current, eventId]))
        : current.filter(id => id !== eventId)
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeError = validateImageUploadSize(file);
      if (sizeError) {
        e.target.value = '';
        toast.error(sizeError);
        return;
      }
      setThumbnail(file);
      setThumbnailPrompt(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailDelete = () => {
    setThumbnail(null);
    setThumbnailPreview(null);
    setThumbnailPrompt(null);
    if (project?.thumbnail) {
      setProject({ ...project, thumbnail: null });
    }
  };

  const handleAIGeneratedImageSelect = async ({
    url,
    prompt,
  }: {
    url: string;
    prompt: string;
  }) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], 'ai-generated-thumbnail.webp', {
        type: 'image/webp',
      });
      const sizeError = validateImageUploadSize(file);
      if (sizeError) throw new Error(sizeError);

      setThumbnail(file);
      setThumbnailPreview(url);
      setThumbnailPrompt(prompt);
      toast.success('AI-generated image selected!');
    } catch (error) {
      console.error('Error processing AI-generated image:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to process AI-generated image'
      );
    }
  };

  const handleSave = async () => {
    if (!project) return;

    if (formRef.current && !formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', editableTitle);
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }
      if (thumbnailPrompt) {
        formData.append('thumbnailPrompt', thumbnailPrompt);
      }
      formData.append('description', editableDescription);
      formData.append('preview', editablePreview);
      formData.append('startDate', editableStartDate.toISOString());
      project.techTags.forEach(tag => {
        formData.append('techTags[]', tag.id);
      });
      project.domainTags.forEach(tag => {
        formData.append('domainTags[]', tag.id);
      });
      formData.append('githubUrl', editableGithubUrl);
      formData.append('demoUrl', editableDemoUrl);
      formData.append('blogUrl', editableBlogUrl);

      formData.append('participants', JSON.stringify(project.participants));
      formData.append('launchLead', project.launchLead.id);

      formData.append(
        'deleteThumbnail',
        (!thumbnail && thumbnailPreview === null).toString()
      );

      const response = await fetch(`/api/projects/${params?.projectId}/edit`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getImageUploadError(response, 'Failed to update project')
        );
      }

      const updatedProject = await response.json();
      setProject(updatedProject);

      if (project.status === 'APPROVED' && selectedEventIds.length > 0) {
        const eventResponse = await fetch(
          `/api/projects/${params?.projectId}/submit`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'APPROVED',
              eventIds: selectedEventIds,
              sourceEventId: null,
            }),
          }
        );
        if (!eventResponse.ok) {
          throw new Error(
            'The project was saved, but it was not added to the event'
          );
        }
      }

      toast.success('Changes saved successfully!');
      router.push(`/projects/${params?.projectId}`);
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save changes'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    if (formRef.current && !formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }

    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('title', editableTitle);
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }
      if (thumbnailPrompt) {
        formData.append('thumbnailPrompt', thumbnailPrompt);
      }
      formData.append('description', editableDescription);
      formData.append('preview', editablePreview);
      formData.append('startDate', editableStartDate.toISOString());
      project.techTags.forEach(tag => {
        formData.append('techTags[]', tag.id);
      });
      project.domainTags.forEach(tag => {
        formData.append('domainTags[]', tag.id);
      });
      formData.append('githubUrl', editableGithubUrl);
      formData.append('demoUrl', editableDemoUrl);
      formData.append('blogUrl', editableBlogUrl);
      formData.append('participants', JSON.stringify(project.participants));
      formData.append('launchLead', project.launchLead.id);
      formData.append(
        'deleteThumbnail',
        (!thumbnail && thumbnailPreview === null).toString()
      );

      const saveResponse = await fetch(
        `/api/projects/${params?.projectId}/edit`,
        {
          method: 'PATCH',
          body: formData,
        }
      );

      if (!saveResponse.ok) {
        throw new Error(
          await getImageUploadError(saveResponse, 'Failed to save project')
        );
      }

      const publishResponse = await fetch(
        `/api/projects/${params?.projectId}/submit`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'APPROVED',
            eventIds: selectedEventIds,
            sourceEventId,
          }),
        }
      );

      if (!publishResponse.ok) {
        throw new Error('Failed to publish project');
      }

      toast.success('Project published!');
      router.push(
        sourceEventId
          ? (returnTo ?? `/pitch/${sourceEventId}`)
          : `/projects/${params?.projectId}`
      );
    } catch (error) {
      console.error('Error publishing project:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish project'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleRemoveTag = (tagId: string, type: 'tech' | 'domain') => {
    if (!project) return;
    const updatedProject = {
      ...project,
      title: editableTitle,
      preview: editablePreview,
      description: editableDescription,
      startDate: editableStartDate,
      githubUrl: editableGithubUrl,
      demoUrl: editableDemoUrl,
      blogUrl: editableBlogUrl,
      techTags:
        type === 'tech'
          ? project.techTags.filter(tag => tag.id !== tagId)
          : project.techTags,
      domainTags:
        type === 'domain'
          ? project.domainTags.filter(tag => tag.id !== tagId)
          : project.domainTags,
    };

    setProject(updatedProject);
  };

  const handleAddTag = (tagId: string, type: 'tech' | 'domain') => {
    if (!project) return;

    const tagToAdd =
      type === 'tech'
        ? availableTechTags.find(tag => tag.id === tagId)
        : availableDomainTags.find(tag => tag.id === tagId);

    if (!tagToAdd) {
      const fetchTags = async () => {
        try {
          const response = await fetch(`/api/tags/${type}`);
          const data = (await response.json()) as Project['techTags'];
          if (type === 'tech') {
            setAvailableTechTags(data);
            const newTag = data.find(tag => tag.id === tagId);
            if (newTag) {
              setProject({
                ...project,
                title: editableTitle,
                preview: editablePreview,
                description: editableDescription,
                startDate: editableStartDate,
                githubUrl: editableGithubUrl,
                demoUrl: editableDemoUrl,
                blogUrl: editableBlogUrl,
                techTags: [...project.techTags, newTag],
              });
            }
          } else {
            setAvailableDomainTags(data);
            const newTag = data.find(tag => tag.id === tagId);
            if (newTag) {
              setProject({
                ...project,
                title: editableTitle,
                preview: editablePreview,
                description: editableDescription,
                startDate: editableStartDate,
                githubUrl: editableGithubUrl,
                demoUrl: editableDemoUrl,
                blogUrl: editableBlogUrl,
                domainTags: [...project.domainTags, newTag],
              });
            }
          }
        } catch (error) {
          console.error('Error fetching updated tags:', error);
        }
      };
      fetchTags();
      return;
    }

    setProject({
      ...project,
      title: editableTitle,
      preview: editablePreview,
      description: editableDescription,
      startDate: editableStartDate,
      githubUrl: editableGithubUrl,
      demoUrl: editableDemoUrl,
      blogUrl: editableBlogUrl,
      techTags:
        type === 'tech' ? [...project.techTags, tagToAdd] : project.techTags,
      domainTags:
        type === 'domain'
          ? [...project.domainTags, tagToAdd]
          : project.domainTags,
    });
  };

  const handleAddMember = (hacker: HackerSelectionOption, role: string) => {
    if (!project) return;
    setProject({
      ...project,
      participants: [...project.participants, { role, hacker }],
    });
  };

  const handleRemoveMember = (hackerId: string) => {
    if (!project) return;
    setProject({
      ...project,
      participants: project.participants.filter(
        participant => participant.hacker.id !== hackerId
      ),
    });
  };

  const handleChangeLaunchLead = (hacker: HackerSelectionOption) => {
    if (!project || !userInfo) return;
    if (project.launchLead.id === userInfo.id && hacker.id !== userInfo.id) {
      if (
        !confirm(
          'Warning: If you change the launch lead from yourself, you will lose access to managing team members after saving. Continue?'
        )
      ) {
        return;
      }
    }
    const updatedProject = {
      ...project,
      launchLead: hacker,
      participants: [
        ...project.participants.filter(p => p.hacker.id !== hacker.id),
        ...(!project.participants.some(
          p => p.hacker.id === project.launchLead.id
        ) && project.launchLead.id !== hacker.id
          ? [
              {
                role: 'hacker',
                hacker: project.launchLead,
              },
            ]
          : []),
      ],
    };
    setProject(updatedProject);
    setShowLaunchLeadModal(false);
  };

  const allowedEdit =
    !!project &&
    ((project.participants?.some(
      participant => participant.hacker.id === userInfo?.id
    ) ??
      false) ||
      project.launchLead?.id === userInfo?.id ||
      isAdmin);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= MAX_TITLE_LENGTH) {
      setEditableTitle(e.target.value);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${isDarkMode ? 'border-purple-400' : 'border-indigo-600'}`}
          role="status"
          aria-label="Loading"
        ></div>
      </div>
    );
  }

  if (!allowedEdit) {
    return <PermissionDenied />;
  }

  return (
    <div
      className={`justify-center items-center min-h-screen ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} font-space-mono`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20">
        <div className="space-y-4">
          <ButtonPanel
            params={params}
            router={router}
            isDarkMode={isDarkMode}
            handleSave={handleSave}
            handlePublish={handlePublish}
            saving={saving}
            publishing={publishing}
            isDraft={project?.status === 'DRAFT'}
            contextual={contextual}
          />
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Title
            </label>
            <input
              type="text"
              value={editableTitle}
              onChange={handleTitleChange}
              maxLength={MAX_TITLE_LENGTH}
              className={`mt-1 block w-3/4 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
            <span
              className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {(editableTitle || '').length}/{MAX_TITLE_LENGTH} characters
            </span>
          </div>
          <section
            className={`w-3/4 rounded-lg border p-4 ${
              isDarkMode
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-200 bg-gray-50'
            }`}
            aria-labelledby="project-events-heading"
          >
            <h2 id="project-events-heading" className="font-medium">
              Add to current events
            </h2>
            <p
              className={`mt-1 text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Select an event to add this project. Existing event links stay
              selected.
            </p>
            {eventOptions.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {eventOptions.map(event => (
                  <label
                    key={event.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-900'
                        : 'border-gray-200 bg-white'
                    } ${event.alreadyAdded ? 'cursor-default opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventIds.includes(event.id)}
                      disabled={event.alreadyAdded}
                      onChange={eventSelection =>
                        handleEventSelection(
                          event.id,
                          eventSelection.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Image
                      src={event.image?.url || defaultEventImage}
                      alt={event.image?.alt || `${event.title} event`}
                      width={64}
                      height={48}
                      className="h-12 w-16 rounded bg-black object-contain p-1"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {event.title}
                      </span>
                      <span
                        className={`block truncate text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {event.chapterName}
                        {event.alreadyAdded ? ' · Already added' : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p
                className={`mt-3 text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                You have no current events available.
              </p>
            )}
          </section>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Tech Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.techTags?.map(tag => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-sm flex items-center gap-2 ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-indigo-100 text-indigo-700'}`}
                >
                  {tag.name}
                  <XMarkIcon
                    className="h-4 w-4 cursor-pointer"
                    onClick={() => handleRemoveTag(tag.id, 'tech')}
                  />
                </span>
              ))}
              <button
                onClick={() => setShowTechTagModal(true)}
                className={`px-2 py-1 rounded-full text-sm flex items-center ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-indigo-100 text-indigo-700'}`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Domain Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.domainTags?.map(tag => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-sm flex items-center gap-2 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                >
                  {tag.name}
                  <XMarkIcon
                    className="h-4 w-4 cursor-pointer"
                    onClick={() => handleRemoveTag(tag.id, 'domain')}
                  />
                </span>
              ))}
              <button
                onClick={() => setShowDomainTagModal(true)}
                className={`px-2 py-1 rounded-full text-sm flex items-center ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <TagSelector
            show={showTechTagModal}
            onClose={() => setShowTechTagModal(false)}
            tags={availableTechTags}
            selectedTags={project?.techTags || []}
            onSelect={handleAddTag}
            type="tech"
          />
          <TagSelector
            show={showDomainTagModal}
            onClose={() => setShowDomainTagModal(false)}
            tags={availableDomainTags}
            selectedTags={project?.domainTags || []}
            onSelect={handleAddTag}
            type="domain"
          />
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Project URLs
            </label>
            <form
              ref={formRef}
              onSubmit={e => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-4 mt-2"
            >
              <input
                type="text"
                inputMode="url"
                placeholder="GitHub URL"
                value={editableGithubUrl}
                onChange={e => setEditableGithubUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
              <input
                type="text"
                inputMode="url"
                placeholder="Demo URL"
                value={editableDemoUrl}
                onChange={e => setEditableDemoUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
              <input
                type="text"
                inputMode="url"
                placeholder="Blog URL"
                value={editableBlogUrl}
                onChange={e => setEditableBlogUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
            </form>
          </div>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              One Sentence Description
            </label>
            <textarea
              value={editablePreview}
              onChange={e =>
                e.target.value.length <= MAX_PREVIEW_LENGTH &&
                setEditablePreview(e.target.value)
              }
              maxLength={MAX_PREVIEW_LENGTH}
              className={`mt-1 block w-3/4 border ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              rows={2}
            />
            <span
              className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {(editablePreview || '').length}/{MAX_PREVIEW_LENGTH} characters
            </span>
          </div>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Team Members
            </label>
            {project?.launchLead?.id === userInfo?.id || isAdmin ? (
              <>
                <div className="mt-2">
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${isDarkMode ? 'bg-purple-900/50 text-purple-100 hover:bg-purple-800/50' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
                    onClick={() => setShowLaunchLeadModal(true)}
                  >
                    <span>
                      {swapFirstLetters(project?.launchLead?.name || '')}
                    </span>
                    <span
                      className={`mx-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-400'}`}
                    >
                      •
                    </span>
                    <span
                      className={
                        isDarkMode ? 'text-purple-300' : 'text-purple-600'
                      }
                    >
                      Launch Lead
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {(project?.participants || []).map(participant => (
                    <div
                      key={participant.hacker.id}
                      className={`flex items-center px-3 py-1 rounded-full text-sm ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-indigo-100 text-indigo-800'}`}
                    >
                      <span>{swapFirstLetters(participant.hacker.name)}</span>
                      <span
                        className={`mx-1 ${isDarkMode ? 'text-gray-400' : 'text-indigo-400'}`}
                      >
                        •
                      </span>
                      <span
                        className={
                          isDarkMode ? 'text-gray-300' : 'text-indigo-600'
                        }
                      >
                        {
                          ProjectRoles.find(r => r.id === participant.role)
                            ?.label
                        }
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveMember(participant.hacker.id)
                        }
                        className={`ml-2 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-indigo-600 hover:text-indigo-800'}`}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowTeamModal(true)}
                    className={`text-sm font-medium ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                  >
                    + Add Team Members
                  </button>
                </div>
              </>
            ) : (
              <p
                className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Only the launch lead can add or delete team members. Contact{' '}
                <a
                  href={`/hacker/${project?.launchLead?.id || ''}`}
                  className={`${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                >
                  {swapFirstLetters(project?.launchLead?.name || '')}
                </a>{' '}
                with this.
              </p>
            )}

            <HackerSelector
              showModal={showLaunchLeadModal}
              setShowModal={setShowLaunchLeadModal}
              isDarkMode={isDarkMode}
              searchTerm={leadSearchTerm}
              setSearchTerm={setLeadSearchTerm}
              filteredHackers={filteredLeadHackers}
              handleAddMember={handleChangeLaunchLead}
              title="Change Launch Lead"
              singleSelect={true}
              selectedIds={
                project?.launchLead?.id ? [project.launchLead.id] : []
              }
              showRoleSelector={false}
            />

            <HackerSelector
              showModal={showTeamModal}
              setShowModal={setShowTeamModal}
              isDarkMode={isDarkMode}
              searchTerm={teamSearchTerm}
              setSearchTerm={setTeamSearchTerm}
              filteredHackers={filteredTeamHackers.filter(
                hacker =>
                  !project?.participants.some(p => p.hacker.id === hacker.id)
              )}
              title="Add Team Members"
              selectedIds={(project?.participants ?? []).map(p => p.hacker.id)}
              showRoleSelector={true}
              onAddMemberWithRole={handleAddMember}
            />

            <ImageGenerationModal
              showModal={showImageGenerationModal}
              setShowModal={setShowImageGenerationModal}
              generationEndpoint={`/api/projects/${params?.projectId as string}/generate-images`}
              generationBody={{
                prompt:
                  'Generate pixel-art thumbnails based on project description',
              }}
              subjectLabel="Project"
              subjectTitle={project?.title || ''}
              subjectDescription={project?.preview || ''}
              onImageSelect={handleAIGeneratedImageSelect}
              isDarkMode={isDarkMode}
            />
          </div>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Start Date
            </label>
            <input
              type="date"
              value={
                editableStartDate ? format(editableStartDate, 'yyyy-MM-dd') : ''
              }
              onChange={e => {
                if (!e.target.value) {
                  setEditableStartDate(new Date());
                  return;
                }
                const [year, month, day] = e.target.value.split('-');
                const date = new Date(
                  Number(year),
                  Number(month) - 1,
                  Number(day)
                );
                setEditableStartDate(date);
              }}
              className={`mt-1 block w-64 border${
                isDarkMode
                  ? 'border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark] calendar-picker-indicator:filter-invert'
                  : 'border-gray-300 bg-white text-gray-900 [color-scheme:light]'
              } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
          </div>
          <div>
            <label
              className={`block font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-fira-code`}
            >
              Project Thumbnail
            </label>
            <div className="mt-1 flex items-center space-x-4">
              {thumbnailPreview && (
                <div className="relative aspect-[3/2] w-32 bg-black">
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    fill
                    className="rounded-lg object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleThumbnailDelete}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex space-x-2">
                <label
                  className={`cursor-pointer px-4 py-2 rounded-md shadow-sm font-medium ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {thumbnailPreview ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowImageGenerationModal(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm font-medium ${
                    isDarkMode
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } text-white`}
                >
                  <SparklesIcon className="h-4 w-4" />
                  AI Generate
                </button>
              </div>
            </div>
            <p
              className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Recommended: 1200x800px or larger, 3:2 ratio
            </p>
          </div>
          <div>
            <label
              className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Full Description
            </label>
            <span
              className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Supports{' '}
              <a
                href="https://www.markdownguide.org/basic-syntax"
                target="_blank"
                rel="noopener noreferrer"
              >
                Markdown
              </a>
              ! Use the toolbar.
            </span>
            <div
              className={`mt-2 flex items-center justify-between gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={descriptionView === 'preview'}
                  onClick={() => {
                    const textarea = document.getElementById(
                      'description-textarea'
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    const replacement = selectedText
                      ? `**${selectedText}**`
                      : '**Bold text**';
                    setEditableDescription(
                      text.substring(0, start) +
                        replacement +
                        text.substring(end)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      if (selectedText) {
                        textarea.selectionStart = start + 2;
                        textarea.selectionEnd = start + 2 + selectedText.length;
                      } else {
                        textarea.selectionStart = start + 2;
                        textarea.selectionEnd = start + 10;
                      }
                    }, 0);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  title="Bold (Ctrl+B)"
                >
                  <BoldIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={descriptionView === 'preview'}
                  onClick={() => {
                    const textarea = document.getElementById(
                      'description-textarea'
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    const replacement = selectedText
                      ? `*${selectedText}*`
                      : '*Italic text*';
                    setEditableDescription(
                      text.substring(0, start) +
                        replacement +
                        text.substring(end)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      if (selectedText) {
                        textarea.selectionStart = start + 1;
                        textarea.selectionEnd = start + 1 + selectedText.length;
                      } else {
                        textarea.selectionStart = start + 1;
                        textarea.selectionEnd = start + 11;
                      }
                    }, 0);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  title="Italic (Ctrl+I)"
                >
                  <ItalicIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={descriptionView === 'preview'}
                  onClick={() => {
                    const textarea = document.getElementById(
                      'description-textarea'
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    const replacement = selectedText
                      ? `~~${selectedText}~~`
                      : '~~Struck text~~';
                    setEditableDescription(
                      text.substring(0, start) +
                        replacement +
                        text.substring(end)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      if (selectedText) {
                        textarea.selectionStart = start + 2;
                        textarea.selectionEnd = start + 2 + selectedText.length;
                      } else {
                        textarea.selectionStart = start + 2;
                        textarea.selectionEnd = start + 13;
                      }
                    }, 0);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  title="Strikethrough"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center text-sm font-bold line-through">
                    S
                  </span>
                </button>
                <button
                  type="button"
                  disabled={descriptionView === 'preview'}
                  onClick={() => {
                    const textarea = document.getElementById(
                      'description-textarea'
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    const replacement = selectedText
                      ? `[${selectedText}](url)`
                      : '[Link](url)';
                    setEditableDescription(
                      text.substring(0, start) +
                        replacement +
                        text.substring(end)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      if (selectedText) {
                        textarea.selectionStart =
                          start + selectedText.length + 3;
                        textarea.selectionEnd = start + selectedText.length + 6;
                      } else {
                        textarea.selectionStart = start + 7;
                        textarea.selectionEnd = start + 10;
                      }
                    }, 0);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  title="Add Link"
                >
                  <LinkIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={descriptionView === 'preview'}
                  onClick={() => {
                    const textarea = document.getElementById(
                      'description-textarea'
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    const replacement = `\`${selectedText}\``;
                    setEditableDescription(
                      text.substring(0, start) +
                        replacement +
                        text.substring(end)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      textarea.selectionStart = start + 1;
                      textarea.selectionEnd = start + 1 + selectedText.length;
                    }, 0);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  title="Inline Code"
                >
                  <CodeBracketIcon className="h-5 w-5" />
                </button>
                <label
                  className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                    descriptionView === 'preview'
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }`}
                  title="Upload Image"
                >
                  <PhotoIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={descriptionView === 'preview'}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const imageUrl = await uploadImage(file);
                          const textarea = document.getElementById(
                            'description-textarea'
                          ) as HTMLTextAreaElement;
                          const start = textarea.selectionStart;
                          const text = textarea.value;
                          const imageMarkdown = `![Image](${imageUrl})`;
                          setEditableDescription(
                            text.substring(0, start) +
                              imageMarkdown +
                              text.substring(start)
                          );
                          setTimeout(() => {
                            textarea.focus();
                            textarea.selectionStart = textarea.selectionEnd =
                              start + imageMarkdown.length;
                          }, 0);
                        } catch (error) {
                          console.error('Error uploading image:', error);
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Failed to upload image'
                          );
                        }
                      }
                    }}
                  />
                </label>
              </div>
              <div
                className={`inline-flex overflow-hidden rounded-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
              >
                {(['write', 'preview'] as const).map(view => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setDescriptionView(view)}
                    className={`px-3 py-1.5 text-sm font-medium capitalize ${
                      descriptionView === view
                        ? isDarkMode
                          ? 'bg-gray-700 text-gray-100'
                          : 'bg-gray-100 text-gray-900'
                        : isDarkMode
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-pressed={descriptionView === view}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            {descriptionView === 'write' ? (
              <textarea
                id="description-textarea"
                value={editableDescription}
                onChange={e => setEditableDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.ctrlKey || e.metaKey) {
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selectedText = text.substring(start, end);
                    switch (e.key.toLowerCase()) {
                      case 'b':
                        e.preventDefault();
                        const boldText = `**${selectedText}**`;
                        setEditableDescription(
                          text.substring(0, start) +
                            boldText +
                            text.substring(end)
                        );
                        setTimeout(() => {
                          textarea.selectionStart = start + 2;
                          textarea.selectionEnd =
                            start + 2 + selectedText.length;
                        }, 0);
                        break;
                      case 'i':
                        e.preventDefault();
                        const italicText = `*${selectedText}*`;
                        setEditableDescription(
                          text.substring(0, start) +
                            italicText +
                            text.substring(end)
                        );
                        setTimeout(() => {
                          textarea.selectionStart = start + 1;
                          textarea.selectionEnd =
                            start + 1 + selectedText.length;
                        }, 0);
                        break;
                      case 'x':
                        if (!e.shiftKey) break;
                        e.preventDefault();
                        const strikeText = `~~${selectedText}~~`;
                        setEditableDescription(
                          text.substring(0, start) +
                            strikeText +
                            text.substring(end)
                        );
                        setTimeout(() => {
                          textarea.selectionStart = start + 2;
                          textarea.selectionEnd =
                            start + 2 + selectedText.length;
                        }, 0);
                        break;
                    }
                  }
                }}
                onPaste={async e => {
                  const items = Array.from(e.clipboardData?.items || []);
                  const imageItem = items.find(item =>
                    item.type.startsWith('image/')
                  );
                  if (imageItem) {
                    e.preventDefault();
                    const file = imageItem.getAsFile();
                    if (file) {
                      try {
                        const imageUrl = await uploadImage(file);
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const text = textarea.value;
                        const imageMarkdown = `![Image](${imageUrl})`;
                        setEditableDescription(
                          text.substring(0, start) +
                            imageMarkdown +
                            text.substring(start)
                        );
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd =
                            start + imageMarkdown.length;
                          textarea.focus();
                        }, 0);
                      } catch (error) {
                        console.error('Error uploading image:', error);
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Failed to upload image'
                        );
                      }
                    }
                  }
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-indigo-500');
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-indigo-500');
                }}
                onDrop={async e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-indigo-500');
                  const textarea = e.currentTarget;
                  textarea.focus();

                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    try {
                      const imageUrl = await uploadImage(file);
                      toast.success('Image uploaded successfully');

                      const start =
                        textarea.selectionStart || textarea.value.length;
                      const text = textarea.value;
                      const imageMarkdown = `![${file.name}](${imageUrl})`;
                      setEditableDescription(
                        text.substring(0, start) +
                          imageMarkdown +
                          text.substring(start)
                      );

                      const newPosition = start + imageMarkdown.length;
                      textarea.selectionStart = newPosition;
                      textarea.selectionEnd = newPosition;
                      return;
                    } catch (error) {
                      console.error('Error uploading image:', error);
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Failed to upload image'
                      );
                      return;
                    }
                  }

                  const urlData =
                    e.dataTransfer.getData('text/uri-list') ||
                    e.dataTransfer.getData('text/plain');
                  if (
                    urlData &&
                    (urlData.startsWith('http://') ||
                      urlData.startsWith('https://'))
                  ) {
                    const isImageUrl = /\.(jpg|jpeg|png|gif|webp)$/i.test(
                      urlData
                    );
                    if (isImageUrl) {
                      const start =
                        textarea.selectionStart || textarea.value.length;
                      const text = textarea.value;
                      const filename = urlData.split('/').pop() || 'image';
                      const imageMarkdown = `![${filename}](${urlData})`;
                      setEditableDescription(
                        text.substring(0, start) +
                          imageMarkdown +
                          text.substring(start)
                      );

                      const newPosition = start + imageMarkdown.length;
                      textarea.selectionStart = newPosition;
                      textarea.selectionEnd = newPosition;
                    }
                  }
                }}
                className={`mt-1 block w-full border ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-800 text-gray-100'
                    : 'border-gray-300 bg-white text-gray-900'
                } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
                rows={15}
                placeholder="Write your project description here..."
              />
            ) : (
              <ProjectMarkdown
                markdown={editableDescription}
                className={`mt-1 min-h-[390px] w-full rounded-md border p-4 prose prose-lg max-w-none ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-800 text-gray-100 prose-invert prose-pre:bg-gray-900 prose-a:text-indigo-400'
                    : 'border-gray-300 bg-white text-gray-900 prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600'
                }`}
              />
            )}
          </div>
          <ButtonPanel
            params={params}
            router={router}
            isDarkMode={isDarkMode}
            handleSave={handleSave}
            handlePublish={handlePublish}
            saving={saving}
            publishing={publishing}
            isDraft={project?.status === 'DRAFT'}
            contextual={contextual}
          />
        </div>
      </div>
    </div>
  );
}
