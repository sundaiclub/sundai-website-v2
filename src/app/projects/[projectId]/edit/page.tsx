"use client";
import React, { useRef } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Image from "next/image";

import { useTheme } from "../../../contexts/ThemeContext";
import { useUserContext } from "../../../contexts/UserContext";
import { Project } from "../../../components/Project";
import PermissionDenied from "../../../components/PermissionDenied";
import TagSelector from "../../../components/TagSelector";
import { XMarkIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { HackerSelector, ProjectRoles, Hacker, TeamMember } from "../../../components/HackerSelector";

const MAX_TITLE_LENGTH = 32;
const MAX_PREVIEW_LENGTH = 100;

function ButtonPanel({ params, router, isDarkMode, handleSave, saving }: 
  { params: any, router: any, isDarkMode: boolean, 
    handleSave: () => void, saving: boolean }) {
  return (
    <div className="flex items-center space-x-4 mt-4">
      <button
          onClick={() => router.push(`/projects/${params.projectId}`)}
          className={`flex items-center gap-2 px-4 py-2 transition-colors ${
            isDarkMode 
              ? "bg-gray-700 hover:bg-gray-600 text-gray-100" 
              : "bg-gray-200 hover:bg-gray-300 text-gray-900"
          } shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
        >
        <ArrowLeftIcon className="h-5 w-5" /> Back to Project
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className={`px-4 py-2 ${
          isDarkMode ? "bg-purple-600 hover:bg-purple-700" : "bg-indigo-600 hover:bg-indigo-700"
        } text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2`}
      >
        {saving ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            <span>Saving...</span>
          </>
        ) : (
          <span>Save Changes</span>
        )}
      </button>
    </div>
  );
}

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { isAdmin, userInfo } = useUserContext();
  const { isDarkMode } = useTheme();
  const [project, setProject] = useState<Project | null>(null);

  const [editableTitle, setEditableTitle] = useState("");
  const [editablePreview, setEditablePreview] = useState("");
  const [editableDescription, setEditableDescription] = useState("");
  const [editableStartDate, setEditableStartDate] = useState<Date | null>(null);
  const [editableGithubUrl, setEditableGithubUrl] = useState("");
  const [editableDemoUrl, setEditableDemoUrl] = useState("");
  const [editableBlogUrl, setEditableBlogUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [availableTechTags, setAvailableTechTags] = useState<Project['techTags']>([]);
  const [availableDomainTags, setAvailableDomainTags] = useState<Project['domainTags']>([]);
  const [showTechTagModal, setShowTechTagModal] = useState(false);
  const [showDomainTagModal, setShowDomainTagModal] = useState(false);

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const [hackers, setHackers] = useState<Hacker[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showLaunchLeadModal, setShowLaunchLeadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
    if (project) {
      setEditableTitle(project.title);
      setEditableDescription(project.description);
      setEditablePreview(project.preview);
      setEditableStartDate(project.startDate ? new Date(project.startDate) : null);
      setEditableGithubUrl(project.githubUrl || "");
      setEditableDemoUrl(project.demoUrl || "");
      setEditableBlogUrl(project.blogUrl || "");
      setThumbnailPreview(project.thumbnail?.url || null);
    }
  }, [project]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [techResponse, domainResponse] = await Promise.all([
          fetch('/api/tags/tech'),
          fetch('/api/tags/domain')
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
    fetch("/api/hackers")
      .then((res) => res.json())
      .then((data) => setHackers(data))
      .catch((error) => console.error("Error fetching hackers:", error));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    
    // Trigger form validation
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
      formData.append('description', editableDescription);
      formData.append('preview', editablePreview);
      if (editableStartDate) {
        formData.append('startDate', editableStartDate.toISOString());
      }
      project.techTags.forEach(tag => {
        formData.append('techTags[]', tag.id);
      });
      project.domainTags.forEach(tag => {
        formData.append('domainTags[]', tag.id);
      });
      formData.append('githubUrl', editableGithubUrl);
      formData.append('demoUrl', editableDemoUrl);
      formData.append('blogUrl', editableBlogUrl);

      // Add team members data
      formData.append('participants', JSON.stringify(project.participants));
      formData.append('launchLead', project.launchLead.id);

      const response = await fetch(`/api/projects/${params.projectId}/edit`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update project");
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      toast.success('Changes saved successfully!');
      router.push(`/projects/${params.projectId}`);
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = (tagId: string, type: 'tech' | 'domain') => {
    if (!project) return;
    
    setProject({
      ...project,
      techTags: type === 'tech' 
        ? project.techTags.filter(tag => tag.id !== tagId)
        : project.techTags,
      domainTags: type === 'domain'
        ? project.domainTags.filter(tag => tag.id !== tagId)
        : project.domainTags,
    });
  };

  const handleAddTag = (tagId: string, type: 'tech' | 'domain') => {
    if (!project) return;
    
    const tagToAdd = type === 'tech'
      ? availableTechTags.find(tag => tag.id === tagId)
      : availableDomainTags.find(tag => tag.id === tagId);

    if (!tagToAdd) {
      const fetchTags = async () => {
        try {
          const response = await fetch(`/api/tags/${type}`);
          const data = await response.json();
          if (type === 'tech') {
            setAvailableTechTags(data);
            const newTag = data.find((tag: any) => tag.id === tagId);
            if (newTag) {
              setProject({
                ...project,
                techTags: [...project.techTags, newTag]
              });
            }
          } else {
            setAvailableDomainTags(data);
            const newTag = data.find((tag: any) => tag.id === tagId);
            if (newTag) {
              setProject({
                ...project,
                domainTags: [...project.domainTags, newTag]
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
      techTags: type === 'tech'
        ? [...project.techTags, tagToAdd]
        : project.techTags,
      domainTags: type === 'domain'
        ? [...project.domainTags, tagToAdd]
        : project.domainTags,
    });
  };

  const handleAddMember = (hacker: Hacker) => {
    if (!project) return;
    
    // Add member locally
    setProject({
      ...project,
      participants: [
        ...project.participants,
        {
          role: "hacker",
          hacker: hacker
        }
      ]
    });
  };

  const handleRemoveMember = (hackerId: string) => {
    if (!project) return;
    
    // Remove member locally
    setProject({
      ...project,
      participants: project.participants.filter(
        participant => participant.hacker.id !== hackerId
      )
    });
  };

  const handleChangeLaunchLead = (hacker: Hacker) => {
    if (!project || !userInfo) return;
    
    // Show warning if changing from self
    if (project.launchLead.id === userInfo.id && hacker.id !== userInfo.id) {
      if (!confirm("Warning: If you change the launch lead from yourself, you will lose access to managing team members after saving. Continue?")) {
        return;
      }
    }

    // Create updated project state
    const updatedProject = {
      ...project,
      launchLead: hacker,
      participants: [
        // Keep all existing participants except the new launch lead
        ...project.participants.filter(p => p.hacker.id !== hacker.id),
        // Add current launch lead to participants if changing from self
        ...(project.launchLead.id === userInfo.id ? [
          { role: "hacker", hacker: project.launchLead }
        ] : [])
      ]
    };
    
    setProject(updatedProject);
  };

  const allowedEdit = project && (
    project.participants.some(
      (participant) => participant.hacker.id === userInfo?.id
    ) || (project.launchLead.id === userInfo?.id) || isAdmin
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= MAX_TITLE_LENGTH) {
      setEditableTitle(e.target.value);
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

  if (!allowedEdit) { return (<PermissionDenied/>); }

  return (
    <div
      className={` justify-center items-center min-h-screen ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono`}
    >
      <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20`}>
        <div className="space-y-4">
        <ButtonPanel 
              params={params} 
              router={router} 
              isDarkMode={isDarkMode} 
              handleSave={handleSave} 
              saving={saving} 
            />
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Title
            </label>
            <input
              type="text"
              value={editableTitle}
              onChange={handleTitleChange}
              maxLength={MAX_TITLE_LENGTH}
              className={`mt-1 block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
            <span className={` text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {editableTitle.length}/{MAX_TITLE_LENGTH} characters
            </span>
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Tech Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.techTags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-sm flex items-center gap-2 ${
                    isDarkMode
                      ? "bg-purple-900/50 text-purple-300"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
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
                className={`px-2 py-1 rounded-full text-sm flex items-center ${
                  isDarkMode
                    ? "bg-purple-900/50 text-purple-300"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Domain Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.domainTags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-sm flex items-center gap-2 ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-700"
                  }`}
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
                className={`px-2 py-1 rounded-full text-sm flex items-center ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-100 text-gray-700"
                }`}
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
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Project URLs
            </label>
            <form ref={formRef} onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }} className="space-y-4 mt-2">
              <input
                type="url"
                placeholder="GitHub URL"
                value={editableGithubUrl}
                onChange={(e) => setEditableGithubUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
              <input
                type="url"
                placeholder="Demo URL"
                value={editableDemoUrl}
                onChange={(e) => setEditableDemoUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
              <input
                type="url"
                placeholder="Blog URL"
                value={editableBlogUrl}
                onChange={(e) => setEditableBlogUrl(e.target.value)}
                className={`block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              />
            </form>
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              One Sentence Description
            </label>
            <textarea
              value={editablePreview}
              onChange={(e) => e.target.value.length <= MAX_PREVIEW_LENGTH && setEditablePreview(e.target.value)}
              maxLength={MAX_PREVIEW_LENGTH}
              className={`mt-1 block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              rows={2}
            />
            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {editablePreview.length}/{MAX_PREVIEW_LENGTH} characters
            </span>
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Team Members
            </label>
            {project?.launchLead.id === userInfo?.id || isAdmin ? (
              <>
                <div className="mt-2">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                    isDarkMode 
                      ? 'bg-purple-900/50 text-purple-100 hover:bg-purple-800/50' 
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`} onClick={() => setShowLaunchLeadModal(true)}>
                    <span>{project?.launchLead.name}</span>
                    <span className={`mx-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-400'}`}>•</span>
                    <span className={isDarkMode ? 'text-purple-300' : 'text-purple-600'}>Launch Lead</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {project?.participants.map((participant) => (
                    <div
                      key={participant.hacker.id}
                      className={`flex items-center px-3 py-1 rounded-full text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-100' 
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      <span>{participant.hacker.name}</span>
                      <span className={`mx-1 ${isDarkMode ? 'text-gray-400' : 'text-indigo-400'}`}>•</span>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-indigo-600'}>
                        {ProjectRoles.find((r) => r.id === participant.role)?.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(participant.hacker.id)}
                        className={`ml-2 ${
                          isDarkMode 
                            ? 'text-gray-400 hover:text-gray-200' 
                            : 'text-indigo-600 hover:text-indigo-800'
                        }`}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowTeamModal(true)}
                    className={`text-sm font-medium ${
                      isDarkMode 
                        ? 'text-indigo-400 hover:text-indigo-300' 
                        : 'text-indigo-600 hover:text-indigo-800'
                    }`}
                  >
                    + Add Team Members
                  </button>
                </div>
              </>
            ) : (
              <p className={`mt-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Only the launch lead can add or delete team members. Contact <a 
                  href={`/hacker/${project?.launchLead.id}`}
                  className={`${isDarkMode ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
                >
                  {project?.launchLead.name}
                </a> with this.
              </p>
            )}

            <HackerSelector
              showModal={showLaunchLeadModal}
              setShowModal={setShowLaunchLeadModal}
              isDarkMode={isDarkMode}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filteredHackers={hackers}
              handleAddMember={handleChangeLaunchLead}
              title="Change Launch Lead"
              singleSelect={true}
              selectedIds={project?.launchLead ? [project.launchLead.id] : []}
            />

            <HackerSelector
              showModal={showTeamModal}
              setShowModal={setShowTeamModal}
              isDarkMode={isDarkMode}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filteredHackers={hackers.filter(
                (hacker) => !project?.participants.some(p => p.hacker.id === hacker.id)
              )}
              handleAddMember={handleAddMember}
              title="Add Team Members"
              selectedIds={project?.participants.map(p => p.hacker.id) || []}
            />
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Start Date
            </label>
            <input
              type="date"
              value={editableStartDate ? format(editableStartDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setEditableStartDate(e.target.value ? new Date(e.target.value) : null)}
              className={`mt-1 block w-64 border${
                isDarkMode 
                  ? "border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark] calendar-picker-indicator:filter-invert" 
                  : "border-gray-300 bg-white text-gray-900 [color-scheme:light]"
              } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
          </div>
          <div>
            <label className={`block font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Project Thumbnail
            </label>
            <div className="mt-1 flex items-center space-x-4">
              {thumbnailPreview && (
                <div className="relative w-32 aspect-video">
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    fill
                    className="object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnail(null);
                      setThumbnailPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              <label className={`cursor-pointer px-4 py-2 rounded-md shadow-sm font-medium ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
              }`}>
                {thumbnailPreview ? "Change Image" : "Upload Image"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            </div>
            <p className={`mt-2 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Recommended: 1200x630px or larger, 16:9 ratio
            </p>
          </div>
          <div>
            <label className={`block font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Full Description
            </label>
            <span className={` text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Supports <a href="https://www.markdownguide.org/basic-syntax" target="_blank" rel="noopener noreferrer">Markdown</a>! Try embedding images by hosting them somewhere publicly and linking with the <a href="https://www.markdownguide.org/basic-syntax/#images" target="_blank" rel="noopener noreferrer">Markdown syntax</a>.
            </span>
            <textarea
              value={editableDescription}
              onChange={(e) => setEditableDescription(e.target.value)}
              className={`mt-1 block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
              rows={10}
            />
          </div>

          <ButtonPanel 
            params={params} 
            router={router} 
            isDarkMode={isDarkMode} 
            handleSave={handleSave} 
            saving={saving} 
          />
        </div>
      </div>
    </div>
  );
}

