"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import Image from "next/image";
import SubmissionGrid from "../../components/Submission";
import type { Submission } from "@/app/components/Submission";
import { toast } from "react-hot-toast";

export default function HackerProfile() {
  const params = useParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { userInfo } = useUserContext();
  const [hacker, setHacker] = useState<any>(null);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    const fetchHacker = async () => {
      try {
        const response = await fetch(`/api/hackers/${params.hackerId}`);
        if (response.ok) {
          const data = await response.json();
          setHacker(data);
          // Initialize form fields
          setName(data.name || "");
          setBio(data.bio || "");
          setGithubUrl(data.githubUrl || "");
          setLinkedinUrl(data.linkedinUrl || "");
          setTwitterUrl(data.twitterUrl || "");
          setWebsiteUrl(data.websiteUrl || "");

          // Set submissions
          const leadSubmissions = data.ledSubmissions || [];
          const participantSubmissions =
            data.submissionParticipations?.map((p: any) => p.submission) || [];
          const allSubs = [...leadSubmissions, ...participantSubmissions];
          const uniqueSubmissions = Array.from(
            new Map(allSubs.map((sub) => [sub.id, sub])).values()
          );
          setAllSubmissions(uniqueSubmissions);
        }
      } catch (error) {
        console.error("Error fetching hacker:", error);
      }
    };

    if (params.hackerId) {
      fetchHacker();
    }
  }, [params.hackerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/hackers/${params.hackerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          bio,
          githubUrl,
          linkedinUrl,
          twitterUrl,
          websiteUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedHacker = await response.json();
      setHacker(updatedHacker);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!hacker) {
    return <div>Loading...</div>;
  }

  const isOwnProfile = userInfo?.id === params.hackerId;

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } min-h-screen pt-20 font-space-mono`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="relative w-20 h-20">
              <Image
                src={hacker.avatar?.url || "/images/default_avatar.svg"}
                alt={hacker.name}
                fill
                className="rounded-full object-cover"
              />
            </div>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="Name"
                  required
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="Bio"
                  rows={3}
                />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="GitHub URL"
                />
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="LinkedIn URL"
                />
                <input
                  type="url"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="Twitter URL"
                />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className={`w-full p-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-800 text-gray-100"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholder="Website URL"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className={`px-4 py-2 rounded-md ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`px-4 py-2 rounded-md ${
                      isDarkMode
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "bg-indigo-500 hover:bg-indigo-600"
                    } text-white`}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h1 className="text-3xl font-bold">{hacker.name}</h1>
                <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
                  {hacker.bio || "No bio provided"}
                </p>
                <div className="mt-2 space-x-4">
                  {hacker.githubUrl && (
                    <a
                      href={hacker.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${
                        isDarkMode
                          ? "text-indigo-400 hover:text-indigo-300"
                          : "text-indigo-600 hover:text-indigo-700"
                      }`}
                    >
                      GitHub
                    </a>
                  )}
                  {hacker.linkedinUrl && (
                    <a
                      href={hacker.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${
                        isDarkMode
                          ? "text-indigo-400 hover:text-indigo-300"
                          : "text-indigo-600 hover:text-indigo-700"
                      }`}
                    >
                      LinkedIn
                    </a>
                  )}
                  {hacker.twitterUrl && (
                    <a
                      href={hacker.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${
                        isDarkMode
                          ? "text-indigo-400 hover:text-indigo-300"
                          : "text-indigo-600 hover:text-indigo-700"
                      }`}
                    >
                      Twitter
                    </a>
                  )}
                  {hacker.websiteUrl && (
                    <a
                      href={hacker.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm ${
                        isDarkMode
                          ? "text-indigo-400 hover:text-indigo-300"
                          : "text-indigo-600 hover:text-indigo-700"
                      }`}
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 rounded-md ${
                isDarkMode
                  ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Submissions</h2>
          {allSubmissions.length > 0 ? (
            <SubmissionGrid
              initialSubmissions={allSubmissions}
              showSearch={false}
              show_team={true}
            />
          ) : (
            <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
              No submissions yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
