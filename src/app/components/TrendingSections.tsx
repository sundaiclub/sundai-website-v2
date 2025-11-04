"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Project as ProjectType, ProjectCard } from "./Project";
import { calculateProjectScore } from '@/lib/trending';

interface TrendingSectionsProps {
  projects: ProjectType[];
  setProjects?: (projects: ProjectType[]) => void;
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

export default function TrendingSections({ projects, setProjects, userInfo, handleLike, isDarkMode }: TrendingSectionsProps) {
  const [trendingWeek, setTrendingWeek] = useState<ProjectType[]>([]);
  const [trendingMonth, setTrendingMonth] = useState<ProjectType[]>([]);
  const [trendingAllTime, setTrendingAllTime] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const [wRes, mRes, aRes] = await Promise.all([
          fetch("/api/projects/trending?range=week&limit=5"),
          fetch("/api/projects/trending?range=month&limit=5"),
          fetch("/api/projects/trending?range=all&limit=5"),
        ]);

        const [wData, mData, aData] = await Promise.all([
          wRes.json(),
          mRes.json(),
          aRes.json(),
        ]);

        const week = Array.isArray(wData) ? wData : [];
        const month = Array.isArray(mData) ? mData : [];
        const all = Array.isArray(aData) ? aData : [];

        setTrendingWeek(week);
        setTrendingMonth(month);
        setTrendingAllTime(all);

        // if you still want the parent to know about “some projects”, you can push them up:
        if (setProjects) {
          // de-dup by id (optional)
          const merged = [...week, ...month, ...all];
          setProjects(merged);
        }
      } catch (err) {
        console.error("Error fetching trending projects:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrending();
  }, [setProjects]);

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
      {loading ? (
          <div className="flex justify-center items-center py-20">
            <div
              className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
                isDarkMode ? 'border-purple-400' : 'border-indigo-600'
              }`}
            ></div>
          </div>
        ) : (
          <>
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
            {trendingWeek.length} projects
          </div>
        </div>

        <div className="scroll-container">
          {trendingWeek.map((project) => (
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
            {trendingMonth.length} projects
          </div>
        </div>

        <div className="scroll-container">
          {trendingMonth.map((project) => (
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
            {trendingAllTime.length} projects
          </div>
        </div>

        <div className="scroll-container">
          {trendingAllTime.map((project) => (
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
        </>)}
    </div>
  );
}
