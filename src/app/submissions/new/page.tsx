"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { useTheme } from "../../contexts/ThemeContext";
import HackerSelector from "../../components/HackerSelector";
import type { TeamMember } from "../../components/HackerSelector";

const MAX_PREVIEW_LENGTH = 100;
const MAX_TITLE_LENGTH = 32;

export default function NewSubmission() {
  const { user } = useUser();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showHackerSelector, setShowHackerSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredHackers, setFilteredHackers] = useState([]);
  const [hackers, setHackers] = useState([]);

  useEffect(() => {
    // Fetch hackers when component mounts
    fetch("/api/hackers")
      .then((res) => res.json())
      .then((data) => {
        setHackers(data);
        setFilteredHackers(data);
      })
      .catch((error) => console.error("Error fetching hackers:", error));
  }, []);

  useEffect(() => {
    // Filter hackers based on search term
    const filtered = hackers.filter((hacker) =>
      hacker.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredHackers(filtered);
  }, [searchTerm, hackers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get current week
      const weekResponse = await fetch("/api/weeks/current");
      const weekData = await weekResponse.json();

      const submissionData = {
        title,
        preview,
        description,
        githubUrl,
        demoUrl,
        participants: selectedMembers.map((member) => ({
          id: member.id,
          role: member.role || "DEVELOPER",
        })),
        techTags: [], // Add if you want to support tech tags
        domainTags: [], // Add if you want to support domain tags
        weekId: weekData?.id, // Connect to current week
      };

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      // If there's a thumbnail, upload it separately
      if (thumbnail) {
        const formData = new FormData();
        formData.append("file", thumbnail);

        const thumbnailResponse = await fetch(
          `/api/submissions/${data.id}/thumbnail`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!thumbnailResponse.ok) {
          toast.error("Submission created but failed to upload thumbnail");
        }
      }

      toast.success("Submission created successfully!");
      router.push(`/submissions/${data.id}`);
    } catch (error) {
      console.error("Error creating submission:", error);
      toast.error("Failed to create submission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = (hacker: any, role: string) => {
    if (selectedMembers.some((member) => member.id === hacker.id)) {
      toast.error("This team member has already been added");
      return;
    }

    setSelectedMembers([
      ...selectedMembers,
      {
        id: hacker.id,
        name: hacker.name,
        role: role,
        avatar: hacker.avatar,
      },
    ]);
    setShowHackerSelector(false);
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Create New Submission</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              required
              className={`w-full p-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100"
                  : "bg-gray-100 text-gray-900"
              }`}
            />
          </div>

          {/* Preview Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Preview</label>
            <textarea
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              maxLength={MAX_PREVIEW_LENGTH}
              required
              rows={2}
              className={`w-full p-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100"
                  : "bg-gray-100 text-gray-900"
              }`}
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className={`w-full p-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100"
                  : "bg-gray-100 text-gray-900"
              }`}
            />
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                GitHub URL
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className={`w-full p-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-800 text-gray-100"
                    : "bg-gray-100 text-gray-900"
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Demo URL</label>
              <input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                className={`w-full p-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-800 text-gray-100"
                    : "bg-gray-100 text-gray-900"
                }`}
              />
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Thumbnail</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setThumbnail(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setThumbnailPreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className={`w-full p-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100"
                  : "bg-gray-100 text-gray-900"
              }`}
            />
            {thumbnailPreview && (
              <div className="mt-2 relative w-32 h-32">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnail(null);
                    setThumbnailPreview(null);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Team Members */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Team Members
            </label>
            <button
              type="button"
              onClick={() => setShowHackerSelector(true)}
              className={`w-full p-2 rounded-md text-left ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100 hover:bg-gray-700"
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200"
              }`}
            >
              {selectedMembers.length > 0
                ? `${selectedMembers.length} member${
                    selectedMembers.length === 1 ? "" : "s"
                  } selected`
                : "Click to add team members"}
            </button>

            {/* Display selected members */}
            <div className="mt-2 space-y-2">
              {selectedMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-2 rounded-md ${
                    isDarkMode ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <img
                      src={member.avatar?.url || "/images/default_avatar.svg"}
                      alt={member.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <span>{member.name}</span>
                    <span
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      • {member.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMembers(
                        selectedMembers.filter((m) => m.id !== member.id)
                      );
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            <HackerSelector
              showModal={showHackerSelector}
              setShowModal={setShowHackerSelector}
              isDarkMode={isDarkMode}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filteredHackers={filteredHackers}
              title="Add Team Members"
              selectedIds={selectedMembers.map((member) => member.id)}
              showRoleSelector={true}
              onAddMemberWithRole={handleAddMember}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end mt-8">
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2 rounded-md ${
                isDarkMode
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-indigo-500 hover:bg-indigo-600"
              } text-white transition-colors duration-200 disabled:opacity-50`}
            >
              {submitting ? "Creating..." : "Create Submission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
