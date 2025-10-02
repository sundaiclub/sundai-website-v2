"use client";
import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTheme } from "../contexts/ThemeContext";
import ProjectGrid, { Project as ProjectType, ProjectCard } from "./Project";
import { 
  calculateThisWeekTrendingScore, 
  calculateThisMonthTrendingScore, 
  calculateBestOfAllTimeScore,
  getThisWeekProjects, 
  getThisMonthProjects, 
  getAllTimeProjects 
} from "./ProjectSearch";

interface TrendingSectionsProps {
  projects: ProjectType[];
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
}

const TrendingProjectCard = ({ project, userInfo, handleLike, isDarkMode, showTrendingBadge = false }: {
  project: ProjectType;
  userInfo: any;
  handleLike: (e: React.MouseEvent, projectId: string, isLiked: boolean) => void;
  isDarkMode: boolean;
  showTrendingBadge?: boolean;
}) => {
  const isLiked = project.likes.some(like => like.hackerId === userInfo?.id);
  return (
    <Link href={`/projects/${project.id}`} className="block h-full w-full focus:outline-none" aria-label={`View project ${project.title}`}>
      <motion.div whileHover={{ y: -4 }}>
        <ProjectCard
          project={project}
          userInfo={userInfo}
          handleLike={handleLike}
          isDarkMode={isDarkMode}
          show_status={false}
          show_team={true}
          variant="trending"
          showTrendingBadge={showTrendingBadge}
        />
      </motion.div>
    </Link>
  );
};

export default function TrendingSections({ projects, userInfo, handleLike, isDarkMode }: TrendingSectionsProps) {
  // Get projects for each category
  const thisWeekProjects = getThisWeekProjects(projects);
  const thisMonthProjects = getThisMonthProjects(projects);
  const allTimeProjects = getAllTimeProjects(projects);

  // Sort by appropriate trending score for each category
  const sortByThisWeekTrending = (a: ProjectType, b: ProjectType) => {
    return calculateThisWeekTrendingScore(b) - calculateThisWeekTrendingScore(a);
  };

  const sortByThisMonthTrending = (a: ProjectType, b: ProjectType) => {
    return calculateThisMonthTrendingScore(b) - calculateThisMonthTrendingScore(a);
  };

  const sortByBestOfAllTime = (a: ProjectType, b: ProjectType) => {
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
          <motion.div variants={cardVariants} className="scroll-item w-48 flex-shrink-0 items-center">
            <Link href="/projects" className="flex items-center justify-center w-full h-full text-center">
              <span className={`${isDarkMode ? 'text-purple-300' : 'text-indigo-600'} font-semibold inline-block transition-transform duration-150 hover:-translate-y-0.5 hover:${isDarkMode ? 'text-purple-200' : 'text-indigo-700'}`}>See more →</span>
            </Link>
          </motion.div>
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
          <motion.div variants={cardVariants} className="scroll-item w-48 flex-shrink-0 items-center">
            <Link href="/projects" className="flex items-center justify-center w-full h-full text-center">
              <span className={`${isDarkMode ? 'text-purple-300' : 'text-indigo-600'} font-semibold inline-block transition-transform duration-150 hover:-translate-y-0.5 hover:${isDarkMode ? 'text-purple-200' : 'text-indigo-700'}`}>See more →</span>
            </Link>
          </motion.div>
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
          <motion.div variants={cardVariants} className="scroll-item w-48 flex-shrink-0 items-center">
            <Link href="/projects" className="flex items-center justify-center w-full h-full text-center">
              <span className={`${isDarkMode ? 'text-purple-300' : 'text-indigo-600'} font-semibold inline-block transition-transform duration-150 hover:-translate-y-0.5 hover:${isDarkMode ? 'text-purple-200' : 'text-indigo-700'}`}>See more →</span>
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
