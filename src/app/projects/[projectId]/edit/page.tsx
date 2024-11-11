"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import { useTheme } from "../../../contexts/ThemeContext";
import { useUserContext } from "../../../contexts/UserContext";
import { Project } from "../../../components/Project";
import PermissionDenied from "../../../components/PermissionDenied";
import TagSelector from "../../../components/TagSelector";
import { XMarkIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

const MAX_TITLE_LENGTH = 32;
const MAX_PREVIEW_LENGTH = 100;

function ButtonPanel({ params, router, isDarkMode, handleSave, saving }: 
  { params: any, router: any, isDarkMode: boolean, 
    handleSave: () => void, saving: boolean }) {
  return (
    <div className="flex items-center space-x-4 mt-4 text-sm">
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

  const [saving, setSaving] = useState(false);
  const [availableTechTags, setAvailableTechTags] = useState<Project['techTags']>([]);
  const [availableDomainTags, setAvailableDomainTags] = useState<Project['domainTags']>([]);
  const [showTechTagModal, setShowTechTagModal] = useState(false);
  const [showDomainTagModal, setShowDomainTagModal] = useState(false);

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

  const handleSave = async () => {
    if (!project) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${params.projectId}/edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editableTitle,
          description: editableDescription,
          preview: editablePreview,
          startDate: editableStartDate?.toISOString() || null,
          techTags: project.techTags.map(tag => tag.id),
          domainTags: project.domainTags.map(tag => tag.id),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update project");
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      toast.success('Changes saved successfully!');
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
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Title
            </label>
            <input
              type="text"
              value={editableTitle}
              onChange={handleTitleChange}
              maxLength={MAX_TITLE_LENGTH}
              className={`mt-1 block w-3/4 border ${isDarkMode ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {editableTitle.length}/{MAX_TITLE_LENGTH} characters
            </span>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Tech Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.techTags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-xs flex items-center gap-2 ${
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
                className={`px-2 py-1 rounded-full text-xs flex items-center ${
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
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Domain Tags
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.domainTags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-xs flex items-center gap-2 ${
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
                className={`px-2 py-1 rounded-full text-xs flex items-center ${
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
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
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
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Start Date
            </label>
            <input
              type="date"
              value={editableStartDate ? format(editableStartDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setEditableStartDate(e.target.value ? new Date(e.target.value) : null)}
              className={`mt-1 block w-64 border ${
                isDarkMode 
                  ? "border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark] calendar-picker-indicator:filter-invert" 
                  : "border-gray-300 bg-white text-gray-900 [color-scheme:light]"
              } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Full Description
            </label>
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

