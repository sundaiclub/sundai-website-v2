"use client";
import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTheme } from "../contexts/ThemeContext";
import { Project } from "./Project";
import { 
  calculateThisWeekTrendingScore, 
  calculateThisMonthTrendingScore, 
  calculateBestOfAllTimeScore,
  getThisWeekProjects, 
  getThisMonthProjects, 
  getAllTimeProjects 
} from "./ProjectSearch";

interface TrendingSectionsProps {
  projects: Project[];
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
}

const TrendingProjectCard = ({ 
  project, 
  userInfo, 
  handleLike, 
  isDarkMode,
  showTrendingBadge = false
}: {
  project: Project;
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
  showTrendingBadge?: boolean;
}) => {
  const isLiked = project.likes.some(like => like.hackerId === userInfo?.id);

  return (
    <motion.div
      className={`${
        isDarkMode
          ? "bg-gray-800 hover:shadow-purple-400/20"
          : "bg-white hover:shadow-xl"
      } rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-105 relative group`}
      whileHover={{ y: -4 }}
    >
      {/* Trending Badge - Only show when showTrendingBadge is true */}
      {showTrendingBadge && (
        <div className="absolute top-3 left-3 z-10">
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
            isDarkMode 
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" 
              : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
          }`}>
            🔥 Trending
          </div>
        </div>
      )}

      {/* Like Button - Prominent */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={(e) => handleLike(e, project.id, isLiked)}
          className={`p-3 rounded-full transition-all duration-200 shadow-lg ${
            isLiked
              ? "bg-red-500 text-white hover:bg-red-600"
              : isDarkMode
              ? "bg-white/90 text-gray-800 hover:bg-red-500 hover:text-white"
              : "bg-white text-gray-800 hover:bg-red-500 hover:text-white"
          } group/like`}
          aria-label={`Like project ${project.title}`}
        >
          <div className="flex items-center space-x-2">
            <svg 
              className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} 
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span className="text-sm font-bold">{project.likes.length}</span>
          </div>
        </button>
      </div>

      {/* Project Image */}
      <div className="relative h-32 overflow-hidden">
        <Image
          src={
            project.thumbnail?.url ||
            (isDarkMode
              ? "/images/default_project_thumbnail_dark.svg"
              : "/images/default_project_thumbnail_light.svg")
          }
          alt={project.title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-300"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Project Info */}
      <div className="p-4">
        <h3 className={`text-lg font-bold mb-2 line-clamp-2 ${
          isDarkMode ? "text-gray-100" : "text-gray-900"
        }`}>
          {project.title}
        </h3>
        
        <p className={`text-sm mb-3 line-clamp-2 ${
          isDarkMode ? "text-gray-300" : "text-gray-600"
        }`}>
          {project.preview}
        </p>

        {/* Tech Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {project.techTags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className={`px-2 py-1 rounded-full text-xs ${
                isDarkMode
                  ? "bg-purple-900/50 text-purple-300"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {tag.name}
            </span>
          ))}
          {project.techTags.length > 3 && (
            <span className={`px-2 py-1 rounded-full text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              +{project.techTags.length - 3}
            </span>
          )}
        </div>

        {/* Launch Date */}
        <div className={`text-xs ${
          isDarkMode ? "text-gray-400" : "text-gray-500"
        }`}>
          Launched {new Date(project.startDate).toLocaleDateString()}
        </div>
      </div>
    </motion.div>
  );
};

export default function TrendingSections({ projects, userInfo, handleLike, isDarkMode }: TrendingSectionsProps) {
  // Get projects for each category
  const thisWeekProjects = getThisWeekProjects(projects);
  const thisMonthProjects = getThisMonthProjects(projects);
  const allTimeProjects = getAllTimeProjects(projects);

  // Sort by appropriate trending score for each category
  const sortByThisWeekTrending = (a: Project, b: Project) => {
    return calculateThisWeekTrendingScore(b) - calculateThisWeekTrendingScore(a);
  };

  const sortByThisMonthTrending = (a: Project, b: Project) => {
    return calculateThisMonthTrendingScore(b) - calculateThisMonthTrendingScore(a);
  };

  const sortByBestOfAllTime = (a: Project, b: Project) => {
    return calculateBestOfAllTimeScore(b) - calculateBestOfAllTimeScore(a);
  };

  // Always show 5 projects, but if not enough in this week, fill with recent projects
  const trendingThisWeek = thisWeekProjects.length >= 5 
    ? thisWeekProjects.sort(sortByThisWeekTrending).slice(0, 5)
    : [
        ...thisWeekProjects.sort(sortByThisWeekTrending),
        ...projects
          .filter(p => !thisWeekProjects.includes(p))
          .sort(sortByThisWeekTrending)
          .slice(0, 5 - thisWeekProjects.length)
      ];

  const trendingThisMonth = thisMonthProjects.sort(sortByThisMonthTrending).slice(0, 5);
  const bestOfAllTime = allTimeProjects.sort(sortByBestOfAllTime).slice(0, 5);

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* This Week's Trending */}
      <motion.section 
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-3xl font-bold ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}>
            🔥 Hot This Week
          </h2>
          <div className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            {trendingThisWeek.length} projects
          </div>
        </div>
        
        <div className="scroll-container">
          {trendingThisWeek.map((project) => (
            <motion.div key={project.id} variants={cardVariants} className="scroll-item w-80 flex-shrink-0">
              <TrendingProjectCard
                project={project}
                userInfo={userInfo}
                handleLike={handleLike}
                isDarkMode={isDarkMode}
                showTrendingBadge={true}
              />
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* This Month's Trending */}
      <motion.section 
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-3xl font-bold ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}>
            📈 Recent Best
          </h2>
          <div className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            {trendingThisMonth.length} projects
          </div>
        </div>
        
        <div className="scroll-container">
          {trendingThisMonth.map((project) => (
            <motion.div key={project.id} variants={cardVariants} className="scroll-item w-80 flex-shrink-0">
              <TrendingProjectCard
                project={project}
                userInfo={userInfo}
                handleLike={handleLike}
                isDarkMode={isDarkMode}
                showTrendingBadge={false}
              />
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Best of All Time */}
      <motion.section 
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-3xl font-bold ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}>
            ⭐ Best of All Time
          </h2>
          <div className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            {bestOfAllTime.length} projects
          </div>
        </div>
        
        <div className="scroll-container">
          {bestOfAllTime.map((project) => (
            <motion.div key={project.id} variants={cardVariants} className="scroll-item w-80 flex-shrink-0">
              <TrendingProjectCard
                project={project}
                userInfo={userInfo}
                handleLike={handleLike}
                isDarkMode={isDarkMode}
                showTrendingBadge={false}
              />
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
