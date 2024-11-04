"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUserContext } from "../contexts/UserContext";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/solid";

type Project = {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED";
  githubUrl?: string | null;
  demoUrl?: string | null;
  thumbnail?: {
    url: string;
  } | null;
  launchLead: {
    id: string;
    name: string;
    avatar?: {
      url: string;
    } | null;
  };
  participants: Array<{
    role: string;
    hacker: {
      id: string;
      name: string;
      avatar?: {
        url: string;
      } | null;
    };
  }>;
};

type JoinModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (role: string) => void;
  projectTitle: string;
};

const JoinModal = ({
  isOpen,
  onClose,
  onJoin,
  projectTitle,
}: JoinModalProps) => {
  const [selectedRole, setSelectedRole] = useState("MEMBER");

  const roles = [
    { id: "MEMBER", label: "Member" },
    { id: "DEVELOPER", label: "Developer" },
    { id: "DESIGNER", label: "Designer" },
    { id: "PM", label: "Project Manager" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Join Project</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-4">
          Select your role to join "{projectTitle}"
        </p>

        <div className="space-y-4">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`text-gray-900 w-full px-4 py-3 rounded-lg text-left flex items-center space-x-3 ${
                selectedRole === role.id
                  ? "bg-indigo-50 border-2 border-indigo-500"
                  : "border-2 border-gray-200 hover:border-indigo-200"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedRole === role.id
                    ? "border-indigo-500"
                    : "border-gray-400"
                }`}
              >
                {selectedRole === role.id && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </div>
              <span className={selectedRole === role.id ? "font-medium" : ""}>
                {role.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onJoin(selectedRole)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Join Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ProjectsAdmin() {
  const router = useRouter();
  const { isAdmin, userInfo, loading: userLoading } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedProjectTitle, setSelectedProjectTitle] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      if (!userLoading && !userInfo?.role) {
        router.push("/");
        return;
      }

      if (userInfo?.role === "ADMIN" || userInfo?.role === "HACKER") {
        try {
          const response = await fetch("/api/projects?status=PENDING");
          const data = await response.json();
          setProjects(data);
        } catch (error) {
          console.error("Error fetching projects:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProjects();
  }, [userInfo?.role, userLoading, router]);

  const handleApprove = async (projectId: string) => {
    if (!isAdmin) {
      alert("Only admins can approve projects");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectId));
      }
    } catch (error) {
      console.error("Error approving project:", error);
    }
  };

  const handleDelete = async (projectId: string, launchLeadId: string) => {
    if (!isAdmin && userInfo?.id !== launchLeadId) {
      alert("Only project creators or admins can delete projects");
      return;
    }

    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectId));
      } else {
        alert("Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Error deleting project");
    }
  };

  const handleRemoveParticipant = async (
    projectId: string,
    hackerId: string
  ) => {
    if (!userInfo?.role) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/participants/${hackerId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setProjects(
          projects.map((project) => {
            if (project.id === projectId) {
              return {
                ...project,
                participants: project.participants.filter(
                  (p) => p.hacker.id !== hackerId
                ),
              };
            }
            return project;
          })
        );
      } else {
        alert("Failed to remove participant");
      }
    } catch (error) {
      console.error("Error removing participant:", error);
      alert("Error removing participant");
    }
  };

  const handleJoinClick = (projectId: string, projectTitle: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectTitle(projectTitle);
    setJoinModalOpen(true);
  };

  const handleJoinConfirm = async (role: string) => {
    if (!selectedProjectId) return;

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hackerId: userInfo?.id,
          role: role,
        }),
      });

      if (response.ok) {
        // Update local state to reflect the new participant
        setProjects(
          projects.map((project) => {
            if (project.id === selectedProjectId) {
              return {
                ...project,
                participants: [
                  ...project.participants,
                  {
                    role: role,
                    hacker: {
                      id: userInfo?.id || "",
                      name: userInfo?.name || "",
                      avatar: userInfo?.avatar
                        ? { url: userInfo.avatar }
                        : null,
                    },
                  },
                ],
              };
            }
            return project;
          })
        );
        setJoinModalOpen(false);
      } else {
        alert("Failed to join project");
      }
    } catch (error) {
      console.error("Error joining project:", error);
      alert("Error joining project");
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (
    !userInfo?.role ||
    (userInfo.role !== "ADMIN" && userInfo.role !== "HACKER")
  ) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20">
      <div className="flex flex-col space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Project Review</h1>
        <p className="text-gray-600">
          {isAdmin
            ? "Review and approve new project submissions"
            : "View pending projects"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="relative h-40 sm:h-48">
              <Link href={`/projects/${project.id}`}>
                <Image
                  src={
                    project.thumbnail?.url ||
                    "/images/projects_screenshots/week-25.jpg"
                  }
                  alt={project.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </Link>
            </div>
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <Link href={`/projects/${project.id}`}>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                    {project.title}
                  </h3>
                </Link>
                <div className="flex space-x-2">
                  {!project.participants.some(
                    (p) => p.hacker.id === userInfo?.id
                  ) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleJoinClick(project.id, project.title);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors touch-manipulation"
                    >
                      Join
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleApprove(project.id);
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors touch-manipulation"
                    >
                      Approve
                    </button>
                  )}
                  {(isAdmin || userInfo?.id === project.launchLead.id) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(project.id, project.launchLead.id);
                      }}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors touch-manipulation"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <Link href={`/projects/${project.id}`}>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  {project.description}
                </p>
              </Link>

              {/* Team Section */}
              <div className="mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                  Team
                </h4>
                <div className="space-y-2">
                  {/* Launch Lead */}
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {project.launchLead.avatar ? (
                        <Image
                          src={project.launchLead.avatar.url}
                          alt={project.launchLead.name}
                          width={28}
                          height={28}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 text-xs">
                            {project.launchLead.name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-2 sm:ml-3">
                      <p className="text-xs sm:text-sm font-medium text-gray-900">
                        {project.launchLead.name}
                      </p>
                      <p className="text-xs text-indigo-600">Launch Lead</p>
                    </div>
                  </div>

                  {/* Other Participants */}
                  {project.participants.map((participant) => (
                    <div
                      key={participant.hacker.id}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {participant.hacker.avatar ? (
                            <Image
                              src={participant.hacker.avatar.url}
                              alt={participant.hacker.name}
                              width={28}
                              height={28}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-gray-600 text-xs">
                                {participant.hacker.name[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-2 sm:ml-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-900">
                            {participant.hacker.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {participant.role}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleRemoveParticipant(
                            project.id,
                            participant.hacker.id
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                        aria-label="Remove participant"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 sm:h-5 sm:w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="flex space-x-4 mt-4 pt-4 border-t">
                {project.demoUrl && (
                  <Link
                    href={project.demoUrl}
                    className="text-indigo-600 hover:text-indigo-800 text-xs sm:text-sm font-medium"
                    target="_blank"
                  >
                    View Demo →
                  </Link>
                )}
                {project.githubUrl && (
                  <Link
                    href={project.githubUrl}
                    className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium"
                    target="_blank"
                  >
                    GitHub →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No pending projects to review</p>
          </div>
        )}
      </div>

      <JoinModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoin={handleJoinConfirm}
        projectTitle={selectedProjectTitle}
      />
    </div>
  );
}
