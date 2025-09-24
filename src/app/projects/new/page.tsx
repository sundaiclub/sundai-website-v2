"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import {HackerSelector, ProjectRoles, Hacker, TeamMember} from '../../components/HackerSelector';

const MAX_PREVIEW_LENGTH = 100;
const MAX_TITLE_LENGTH = 32;

export default function NewProject() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hackers, setHackers] = useState<Hacker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [project, setProject] = useState({
    title: "",
    preview: "",
    launchLeadId: "",
    members: [] as string[],
  });
  const [selectedRole, setSelectedRole] = useState("hacker");
  const { isDarkMode } = useTheme();
  const [showLaunchLeadModal, setShowLaunchLeadModal] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState("");
  const [leadSearchTerm, setLeadSearchTerm] = useState("");

  useEffect(() => {
    fetch("/api/hackers")
      .then((res) => res.json())
      .then((data) => setHackers(data))
      .catch((error) => console.error("Error fetching hackers:", error));
  }, []);

  useEffect(() => {
    if (user) {
      const currentUserInHackers = hackers.find(h => h.email === user.primaryEmailAddress?.emailAddress);
      if (currentUserInHackers) {
        setProject(prev => ({
          ...prev,
          launchLeadId: currentUserInHackers.id
        }));
      }
    }
  }, [user, hackers]);

  const filteredTeamHackers = hackers.filter(hacker =>
    hacker.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
    hacker.email.toLowerCase().includes(teamSearchTerm.toLowerCase())
  );

  const filteredLeadHackers = hackers.filter(hacker =>
    hacker.name.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    hacker.email.toLowerCase().includes(leadSearchTerm.toLowerCase())
  );

  const handleAddMember = (hacker: Hacker, role: string) => {
    if (selectedMembers.some(member => member.id === hacker.id)) {
      toast.error("This team member has already been added");
      return;
    }

    setSelectedMembers([...selectedMembers, { ...hacker, role }]);
    setProject((prev) => ({
      ...prev,
      members: [...prev.members, hacker.id],
    }));
    setTeamSearchTerm("");
  };

  const handleRemoveMember = (hackerId: string) => {
    setSelectedMembers(
      selectedMembers.filter((member) => member.id !== hackerId)
    );
    setProject((prev) => ({
      ...prev,
      members: prev.members.filter((id) => id !== hackerId),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to create a project");
      return;
    }

    if (!project.launchLeadId) {
      toast.error("Please select a launch lead");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", project.title);
      formData.append("preview", project.preview);
      formData.append("launchLeadId", project.launchLeadId);
      formData.append(
        "members",
        JSON.stringify(
          selectedMembers.map((member) => ({
            id: member.id,
            role: member.role,
          }))
        )
      );

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Failed to create project", {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        toast.error(errorData?.message || "Failed to create project");
        return;
      }

      const projectData = await response.json();
      toast.success("Project created successfully");
      router.push(`/projects/${projectData.id}/edit`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Error creating project");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setProject((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className={`min-h-screen py-16 ${
      isDarkMode 
        ? 'bg-gradient-to-b from-gray-900 to-black text-gray-100' 
        : 'bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800'
    } font-space-mono`}>
      <div className={`max-w-2xl mx-auto p-6 ${
        isDarkMode 
          ? 'bg-gray-800 shadow-lg' 
          : 'bg-white shadow-sm'
      } rounded-lg`}>
        <h1 className={`text-3xl font-bold mb-8 font-space-mono ${
          isDarkMode ? 'text-gray-100' : 'text-gray-900'
        }`}>
          Initialize New Project
        </h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Launch Lead *
            </label>
            <div className="relative">
              {project.launchLeadId ? (
                <div
                  onClick={() => setShowLaunchLeadModal(true)}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                    isDarkMode 
                      ? 'bg-purple-900/50 text-purple-100 hover:bg-purple-800/50' 
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  <span>{hackers.find(h => h.id === project.launchLeadId)?.name}</span>
                  <span className={`mx-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-400'}`}>•</span>
                  <span className={isDarkMode ? 'text-purple-300' : 'text-purple-600'}>Launch Lead</span>
                </div>
              ) : (
                <div
                  onClick={() => setShowLaunchLeadModal(true)}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                    isDarkMode 
                      ? 'bg-purple-900/50 text-purple-100 hover:bg-purple-800/50' 
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  <span>Select Launch Lead</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="title"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}
            >
              Project Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              maxLength={MAX_TITLE_LENGTH}
              value={project.title}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
              placeholder="Enter project title"
            />
            <span className={` text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {project.title.length}/{MAX_TITLE_LENGTH} characters
            </span>
          </div>

          <div>
            <label
              htmlFor="preview"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}
            >
              Brief Description *
            </label>
            <div className="relative">
              <input
                type="text"
                id="preview"
                name="preview"
                required
                maxLength={MAX_PREVIEW_LENGTH}
                value={project.preview}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
                } font-fira-code`}
                placeholder="Brief description of your project"
              />
            </div>
            <span className={` text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {project.preview.length}/{MAX_PREVIEW_LENGTH} characters
            </span>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Team Members
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center px-3 py-1 rounded-full text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-100' 
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  <span>{member.name}</span>
                  <span className={`mx-1 ${isDarkMode ? 'text-gray-400' : 'text-indigo-400'}`}>•</span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-indigo-600'}>
                    {ProjectRoles.find((r) => r.id === member.role)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
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
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className={`text-sm font-medium ${
                isDarkMode 
                  ? 'text-indigo-400 hover:text-indigo-300' 
                  : 'text-indigo-600 hover:text-indigo-800'
              }`}
            >
              + Add Team Members
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`${
                loading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
              } text-white px-6 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center space-x-2`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </form>
      </div>

      <HackerSelector
        showModal={showLaunchLeadModal}
        setShowModal={setShowLaunchLeadModal}
        isDarkMode={isDarkMode}
        searchTerm={leadSearchTerm}
        setSearchTerm={setLeadSearchTerm}
        filteredHackers={filteredLeadHackers}
        handleAddMember={(hacker) => {
          setProject(prev => ({ ...prev, launchLeadId: hacker.id }));
          setShowLaunchLeadModal(false);
        }}
        title="Select Launch Lead"
        singleSelect={true}
        selectedIds={project.launchLeadId ? [project.launchLeadId] : []}
        showRoleSelector={false}
      />

      <HackerSelector
        showModal={showModal}
        setShowModal={setShowModal}
        isDarkMode={isDarkMode}
        searchTerm={teamSearchTerm}
        setSearchTerm={setTeamSearchTerm}
        filteredHackers={filteredTeamHackers.filter(
          (hacker) => !selectedMembers.some(m => m.id === hacker.id)
        )}
        title="Add Team Members"
        selectedIds={selectedMembers.map(m => m.id)}
        showRoleSelector={true}
        onAddMemberWithRole={handleAddMember}
      />
    </div>
  );
}
