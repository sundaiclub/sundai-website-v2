"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Image from "next/image";

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
      reader.onloadend = () => setThumbnailPreview(reader.result as string);
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

      if (thumbnail) formData.append("thumbnail", thumbnail);

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (response.ok) router.push("/");
      else alert("Failed to create project");
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
    <div className="page-background pt-16">
      <div className="form-container">
        <h1 className="form-title">Initialize New Project</h1>

        <form onSubmit={handleSubmit} className="form-section">
          <div>
            <label htmlFor="launchLeadId" className="form-label">
              Launch Lead *
            </label>
            <select
              id="launchLeadId"
              name="launchLeadId"
              required
              value={project.launchLeadId}
              onChange={handleChange}
              className="form-select"
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
            <label htmlFor="title" className="form-label">
              Project Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={project.title}
              onChange={handleChange}
              className="form-input"
              placeholder="Enter project title"
            />
          </div>

          <div>
            <label htmlFor="description" className="form-label">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              value={project.description}
              onChange={handleChange}
              className="form-textarea"
              placeholder="Describe your project"
            />
          </div>

          <div>
            <label htmlFor="githubUrl" className="form-label">
              GitHub URL
            </label>
            <input
              type="url"
              id="githubUrl"
              name="githubUrl"
              value={project.githubUrl}
              onChange={handleChange}
              className="form-input"
              placeholder="https://github.com/username/project"
            />
          </div>

          <div>
            <label htmlFor="demoUrl" className="form-label">
              Demo URL
            </label>
            <input
              type="url"
              id="demoUrl"
              name="demoUrl"
              value={project.demoUrl}
              onChange={handleChange}
              className="form-input"
              placeholder="https://your-demo-url.com"
            />
          </div>

          <div>
            <label className="form-label">Team Members</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedMembers.map((member) => (
                <div key={member.id} className="badge">
                  <span>{member.name}</span>
                  <span className="mx-1">•</span>
                  <span>
                    {roles.find((r) => r.id === member.role)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    className="ml-2 text-indigo-600 hover:text-indigo-800"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="link-button text-sm font-medium"
            >
              + Add Team Members
            </button>
          </div>

          <div>
            <label className="form-label">Project Thumbnail</label>
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
              <label className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                {thumbnailPreview ? "Change Image" : "Upload Image"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Recommended: 1200x630px or larger, 16:9 ratio
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`button-primary ${
                loading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
              } flex items-center space-x-2`}
            >
              {loading ? (
                <>
                  <div className="spinner-small border-white"></div>
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
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Add Team Members</h2>
              <button
                onClick={() => setShowModal(false)}
                className="modal-close-button"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className="form-label">Role</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedRole === role.id
                        ? "bg-indigo-600 text-white"
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
              className="form-input mb-4"
            />

            <div className="max-h-60 overflow-y-auto">
              {filteredHackers.map((hacker) => (
                <button
                  key={hacker.id}
                  onClick={() => handleAddMember(hacker)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium">{hacker.name}</div>
                    <div className="text-sm text-gray-500">{hacker.email}</div>
                  </div>
                  <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Add as {roles.find((r) => r.id === selectedRole)?.label}
                  </span>
                </button>
              ))}
              {filteredHackers.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No members found
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="button-secondary"
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