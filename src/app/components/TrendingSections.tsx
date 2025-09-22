"use client";
import React from "react";
import { ProjectCard } from "./Project";
import { Project } from "./Project";

interface TrendingSectionsProps {
  projects: Project[];
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
}

export default function TrendingSections({
  projects,
  userInfo,
  handleLike,
  isDarkMode,
}: TrendingSectionsProps) {
  // Sort projects for different trending categories
  const hotThisWeek = projects
    .filter(project => {
      const createdAt = new Date(project.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdAt >= weekAgo;
    })
    .sort((a, b) => b.likes.length - a.likes.length)
    .slice(0, 3);

  const recentBest = projects
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const bestOfAllTime = projects
    .sort((a, b) => b.likes.length - a.likes.length)
    .slice(0, 3);

  const renderSection = (title: string, projects: Project[], emoji: string) => (
    <div className="mb-8">
      <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        {emoji} {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            userInfo={userInfo}
            handleLike={handleLike}
            isDarkMode={isDarkMode}
            show_status={false}
            show_team={false}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      {renderSection("Hot This Week", hotThisWeek, "🔥")}
      {renderSection("Recent Best", recentBest, "📈")}
      {renderSection("Best of All Time", bestOfAllTime, "⭐")}
      
      {/* Add trending badge for demonstration */}
      <div className="text-center mt-4">
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          isDarkMode 
            ? 'bg-purple-900 text-purple-200' 
            : 'bg-purple-100 text-purple-800'
        }`}>
          🔥 Trending
        </span>
      </div>
    </div>
  );
}