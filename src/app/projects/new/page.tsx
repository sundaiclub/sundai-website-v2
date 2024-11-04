"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useTheme } from '../../../context/ThemeContext';

type Hacker = {
  id: string;
  name: string;
  email: string;
};

type TeamMember = Hacker & {
  role: string;
};

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
    description: "",
    githubUrl: "",
    demoUrl: "",
    launchLeadId: "",
    members: [] as string[],
  });
  const [selectedRole, setSelectedRole] = useState("engineer");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const { isDarkMode } = useTheme();

  const roles = [
    { id: "engineer", label: "Engineer" },
    { id: "designer", label: "Designer" },
    { id: "pm", label: "Product Manager" },
    { id: "researcher", label: "Researcher" },
    { id: "other", label: "Other" },
  ];

  useEffect(() => {
    fetch("/api/hackers")
      .then((res) => res.json())
      .then((data) => setHackers(data))
      .catch((error) => console.error("Error fetching hackers:", error));
  }, []);

  const filteredHackers = hackers.filter(
    (hacker) =>
      !selectedMembers.find((member) => member.id === hacker.id) &&
      (hacker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hacker.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddMember = (hacker: Hacker) => {
    setSelectedMembers([...selectedMembers, { ...hacker, role: selectedRole }]);
    setProject((prev) => ({
      ...prev,
      members: [...prev.members, hacker.id],
    }));
    setSearchTerm("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to create a project");
      return;
    }

    if (!project.launchLeadId) {
      alert("Please select a launch lead");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", project.title);
      formData.append("description", project.description);
      formData.append("githubUrl", project.githubUrl || "");
      formData.append("demoUrl", project.demoUrl || "");
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

      if (thumbnail) {
        formData.append("thumbnail", thumbnail);
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        router.push("/");
      } else {
        alert("Failed to create project");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Error creating project");
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Launch Lead *
            </label>
            <select
              id="launchLeadId"
              name="launchLeadId"
              required
              value={project.launchLeadId}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
            >
              <option value="">Select Launch Lead</option>
              {hackers.map((hacker) => (
                <option key={hacker.id} value={hacker.id}>
                  {hacker.name} ({hacker.email})
                </option>
              ))}
            </select>
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
              value={project.title}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
              placeholder="Enter project title"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}
            >
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              value={project.description}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
              placeholder="Describe your project"
            />
          </div>

          <div>
            <label
              htmlFor="githubUrl"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}
            >
              GitHub URL
            </label>
            <input
              type="url"
              id="githubUrl"
              name="githubUrl"
              value={project.githubUrl}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
              placeholder="https://github.com/username/project"
            />
          </div>

          <div>
            <label
              htmlFor="demoUrl"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}
            >
              Demo URL
            </label>
            <input
              type="url"
              id="demoUrl"
              name="demoUrl"
              value={project.demoUrl}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
              placeholder="https://your-demo-url.com"
            />
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
                    {roles.find((r) => r.id === member.role)?.label}
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

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            } font-fira-code`}>
              Project Thumbnail
            </label>
            <div className="mt-1 flex items-center space-x-4">
              {thumbnailPreview && (
                <div className="relative w-32 h-32">
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
              <label className={`cursor-pointer px-4 py-2 rounded-md shadow-sm text-sm font-medium ${
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 w-full max-w-md m-4 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold font-space-mono ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Add Team Members
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className={`${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } font-fira-code`}>
                Role
              </label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedRole === role.id
                        ? "bg-indigo-600 text-white"
                        : isDarkMode 
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
              } font-fira-code`}
            />

            <div className="max-h-60 overflow-y-auto">
              {filteredHackers.map((hacker) => (
                <button
                  key={hacker.id}
                  onClick={() => handleAddMember(hacker)}
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center justify-between group ${
                    isDarkMode 
                      ? 'hover:bg-gray-700' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div>
                    <div className={isDarkMode ? 'text-gray-100' : 'text-gray-900 font-medium'}>
                      {hacker.name}
                    </div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      {hacker.email}
                    </div>
                  </div>
                  <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    Add as {roles.find((r) => r.id === selectedRole)?.label}
                  </span>
                </button>
              ))}
              {filteredHackers.length === 0 && (
                <p className={`text-center py-4 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  No members found
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-md ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
