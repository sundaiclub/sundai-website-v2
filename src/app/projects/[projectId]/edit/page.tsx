"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useTheme } from "../../../contexts/ThemeContext";
import { useUserContext } from "../../../contexts/UserContext";
import { Project } from "../../../components/Project";
import PermissionDenied from "../../../components/PermissionDenied";

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { isAdmin, userInfo } = useUserContext();
  const { isDarkMode } = useTheme();
  const [project, setProject] = useState<Project | null>(null);

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


  const allowedEdit = project && (
    project.participants.some(
      (participant) => participant.hacker.id === userInfo?.id
    ) || (project.launchLead.id === userInfo?.id) || isAdmin
  );

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
      className={`lex justify-center items-center min-h-screen ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono`}
    >
      <div className={`max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-20`}>
        
      </div>
    </div>
  );

}

