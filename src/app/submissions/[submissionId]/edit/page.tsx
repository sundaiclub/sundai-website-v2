"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "../../../contexts/ThemeContext";
import { useUserContext } from "../../../contexts/UserContext";
import Image from "next/image";
import { toast } from "react-hot-toast";
import type { Submission } from "@/app/components/Submission";
import HackerSelector from "@/app/components/HackerSelector";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function SubmissionEditPage() {
  const params = useParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { userInfo } = useUserContext();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");

  const [participants, setParticipants] = useState<
    Array<{
      id: string;
      role: string;
      hacker: {
        id: string;
        name: string;
        avatar?: { url: string } | null;
      };
    }>
  >([]);
  const [launchLead, setLaunchLead] = useState<{
    id: string;
    name: string;
    avatar?: { url: string } | null;
  } | null>(null);

  const [showLaunchLeadModal, setShowLaunchLeadModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [teamSearchTerm, setTeamSearchTerm] = useState("");
  const [filteredLeadHackers, setFilteredLeadHackers] = useState([]);
  const [filteredTeamHackers, setFilteredTeamHackers] = useState([]);
  const [hackers, setHackers] = useState([]);
  const isAdmin = userInfo?.role === "ADMIN";

  // Add state for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await fetch(`/api/submissions/${params.submissionId}`);
        if (!response.ok) throw new Error("Failed to fetch submission");
        const data = await response.json();
        setSubmission(data);

        // Initialize form fields
        setTitle(data.title);
        setPreview(data.preview);
        setDescription(data.description);
        setGithubUrl(data.githubUrl || "");
        setDemoUrl(data.demoUrl || "");
        setThumbnailPreview(data.thumbnail?.url || "");
        setParticipants(data.participants);
        setLaunchLead(data.launchLead);
      } catch (error) {
        console.error("Error fetching submission:", error);
        toast.error("Failed to load submission");
      } finally {
        setLoading(false);
      }
    };

    if (params.submissionId) {
      fetchSubmission();
    }
  }, [params.submissionId]);

  useEffect(() => {
    // Fetch all hackers for team selection
    const fetchHackers = async () => {
      try {
        const response = await fetch("/api/hackers");
        const data = await response.json();
        setHackers(data);
        setFilteredLeadHackers(data);
        setFilteredTeamHackers(data);
      } catch (error) {
        console.error("Error fetching hackers:", error);
      }
    };
    fetchHackers();
  }, []);

  // Filter hackers based on search terms
  useEffect(() => {
    const filtered = hackers.filter((hacker) =>
      hacker.name.toLowerCase().includes(leadSearchTerm.toLowerCase())
    );
    setFilteredLeadHackers(filtered);
  }, [leadSearchTerm, hackers]);

  useEffect(() => {
    const filtered = hackers.filter((hacker) =>
      hacker.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
    );
    setFilteredTeamHackers(filtered);
  }, [teamSearchTerm, hackers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("preview", preview);
      formData.append("description", description);
      formData.append("githubUrl", githubUrl);
      formData.append("demoUrl", demoUrl);
      if (thumbnail) {
        formData.append("thumbnail", thumbnail);
      }

      // Add team members data
      formData.append("launchLeadId", launchLead?.id || "");
      formData.append(
        "participants",
        JSON.stringify(
          participants.map((p) => ({
            hackerId: p.hacker.id,
            role: p.role,
          }))
        )
      );

      const response = await fetch(
        `/api/submissions/${params.submissionId}/edit`,
        {
          method: "PATCH",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Failed to update submission");

      toast.success("Submission updated successfully");
      router.push(`/submissions/${params.submissionId}`);
    } catch (error) {
      console.error("Error updating submission:", error);
      toast.error("Failed to update submission");
    } finally {
      setSaving(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleChangeLaunchLead = async (selectedHacker: any) => {
    setLaunchLead({
      id: selectedHacker.id,
      name: selectedHacker.name,
      avatar: selectedHacker.avatar,
    });
    setShowLaunchLeadModal(false);
  };

  const handleAddMember = async (hacker: any, role: string) => {
    setParticipants([
      ...participants,
      {
        id: `${hacker.id}-${role}`,
        role: role,
        hacker: {
          id: hacker.id,
          name: hacker.name,
          avatar: hacker.avatar,
        },
      },
    ]);
    setShowTeamModal(false);
  };

  const handleRemoveMember = (hackerId: string) => {
    setParticipants(participants.filter((p) => p.hacker.id !== hackerId));
  };

  // Add delete handler
  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this submission? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/submissions/${params.submissionId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete submission");

      toast.success("Submission deleted successfully");
      router.push("/submissions");
    } catch (error) {
      console.error("Error deleting submission:", error);
      toast.error("Failed to delete submission");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!submission) return <div>Submission not found</div>;

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } min-h-screen pt-20 font-space-mono`}
    >
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit Submission</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2 rounded-md ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              required
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-2">Preview</label>
            <input
              type="text"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              className={`w-full px-4 py-2 rounded-md ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className={`w-full px-4 py-2 rounded-md ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              required
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
                className={`w-full px-4 py-2 rounded-md ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Demo URL</label>
              <input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                className={`w-full px-4 py-2 rounded-md ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              />
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium mb-2">Thumbnail</label>
            <div className="flex items-center space-x-4">
              {thumbnailPreview && (
                <div className="relative w-32 h-32">
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className={`px-4 py-2 rounded-md ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                } border ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}
              />
            </div>
          </div>

          {/* Team Members */}
          <div>
            <label
              className={`block font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Team Members
            </label>
            {launchLead?.id === userInfo?.id || isAdmin ? (
              <>
                <div className="mt-2">
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                      isDarkMode
                        ? "bg-purple-900/50 text-purple-100 hover:bg-purple-800/50"
                        : "bg-purple-100 text-purple-800 hover:bg-purple-200"
                    }`}
                    onClick={() => setShowLaunchLeadModal(true)}
                  >
                    <span>{launchLead?.name}</span>
                    <span
                      className={`mx-1 ${
                        isDarkMode ? "text-purple-400" : "text-purple-400"
                      }`}
                    >
                      •
                    </span>
                    <span
                      className={
                        isDarkMode ? "text-purple-300" : "text-purple-600"
                      }
                    >
                      Launch Lead
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between p-2 rounded-md ${
                        isDarkMode ? "bg-gray-800" : "bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Image
                          src={
                            participant.hacker.avatar?.url ||
                            "/images/default_avatar.svg"
                          }
                          alt={participant.hacker.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <span>{participant.hacker.name}</span>
                        <span
                          className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          • {participant.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveMember(participant.hacker.id)
                        }
                        className="text-red-500 hover:text-red-600"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowTeamModal(true)}
                    className={`text-sm font-medium ${
                      isDarkMode
                        ? "text-indigo-400 hover:text-indigo-300"
                        : "text-indigo-600 hover:text-indigo-800"
                    }`}
                  >
                    + Add Team Members
                  </button>
                </div>
              </>
            ) : (
              <p
                className={`mt-2 text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Only the launch lead can add or delete team members. Contact{" "}
                <a
                  href={`/hacker/${launchLead?.id}`}
                  className={`${
                    isDarkMode
                      ? "text-indigo-400 hover:text-indigo-300"
                      : "text-indigo-600 hover:text-indigo-700"
                  }`}
                >
                  {launchLead?.name}
                </a>{" "}
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
              selectedIds={launchLead ? [launchLead.id] : []}
              showRoleSelector={false}
            />

            <HackerSelector
              showModal={showTeamModal}
              setShowModal={setShowTeamModal}
              isDarkMode={isDarkMode}
              searchTerm={teamSearchTerm}
              setSearchTerm={setTeamSearchTerm}
              filteredHackers={filteredTeamHackers.filter(
                (hacker) => !participants.some((p) => p.hacker.id === hacker.id)
              )}
              title="Add Team Members"
              selectedIds={participants.map((p) => p.hacker.id)}
              showRoleSelector={true}
              onAddMemberWithRole={handleAddMember}
            />
          </div>

          {/* Submit and Delete Buttons */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`px-6 py-2 rounded-md ${
                isDarkMode
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-red-500 hover:bg-red-600"
              } text-white transition-colors duration-200 disabled:opacity-50`}
            >
              {deleting ? "Deleting..." : "Delete Submission"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 rounded-md ${
                isDarkMode
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-indigo-500 hover:bg-indigo-600"
              } text-white transition-colors duration-200 disabled:opacity-50`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
