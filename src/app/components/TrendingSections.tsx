'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ProjectCard } from './Project';
import EventSummaryCard from './EventSummaryCard';
import type { Project as ProjectType } from '@/types/project';
import { calculateProjectScore } from '@/lib/trending';
import type { PublicEventCard as PublicEventCardData } from '@/types/event-management';
import type { UserInfo } from '../contexts/UserContext';

const HOT_PROJECT_LIKE_WINDOW_DAYS = 7;

interface TrendingSectionsProps {
  events?: PublicEventCardData[];
  projects: ProjectType[];
  userInfo: UserInfo | null;
  handleLike: (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => void;
  isDarkMode: boolean;
}

const TrendingProjectCard = ({
  project,
  userInfo,
  handleLike,
  isDarkMode,
  showTrendingBadge = false,
}: {
  project: ProjectType;
  userInfo: UserInfo | null;
  handleLike: (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => void;
  isDarkMode: boolean;
  showTrendingBadge?: boolean;
}) => {
  return (
    <motion.div whileHover={{ y: -4 }} className="h-full w-full">
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
  );
};

export default function TrendingSections({
  events = [],
  projects,
  userInfo,
  handleLike,
  isDarkMode,
}: TrendingSectionsProps) {
  const sortByVotesThisWeek = (a: ProjectType, b: ProjectType) => {
    return (
      calculateProjectScore(b, {
        recentLikeWindowDays: HOT_PROJECT_LIKE_WINDOW_DAYS,
      }) -
      calculateProjectScore(a, {
        recentLikeWindowDays: HOT_PROJECT_LIKE_WINDOW_DAYS,
      })
    );
  };

  const sortByBestOfAllTime = (a: ProjectType, b: ProjectType) => {
    return (
      calculateProjectScore(b, { timeDecayDays: undefined }) -
      calculateProjectScore(a, { timeDecayDays: undefined })
    );
  };

  const topProjectsThisWeek = [...projects]
    .sort(sortByVotesThisWeek)
    .slice(0, 5);
  const bestOfAllTime = [...projects].sort(sortByBestOfAllTime).slice(0, 5);

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <motion.section
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className={`text-3xl font-bold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              Events This Week
            </h2>
            <p
              className={`mt-1 text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Upcoming events from Sundai chapters around the world.
            </p>
          </div>
          <Link
            href="/events"
            className={`${isDarkMode ? 'text-purple-300 hover:text-purple-200' : 'text-indigo-600 hover:text-indigo-700'} text-sm font-semibold`}
          >
            See all events →
          </Link>
        </div>

        {events.length === 0 ? (
          <div
            className={`rounded-xl border p-6 text-sm ${
              isDarkMode
                ? 'border-gray-700 bg-gray-800 text-gray-300'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            No events are scheduled for the rest of this week.
          </div>
        ) : (
          <div className="scroll-container">
            {events.map(event => (
              <motion.div
                key={event.id}
                variants={cardVariants}
                className="scroll-item w-80 flex-shrink-0"
              >
                <EventSummaryCard
                  className="h-[360px]"
                  event={event}
                  eyebrow={event.chapterName}
                  href={`/events/${event.chapterSlug}/${event.slug}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2
              className={`text-3xl font-bold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              🔥 Hot This Week
            </h2>
          </div>
          <div
            className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {topProjectsThisWeek.length} projects
          </div>
        </div>

        <div className="scroll-container">
          {topProjectsThisWeek.map(project => (
            <motion.div
              key={project.id}
              variants={cardVariants}
              className="scroll-item w-80 flex-shrink-0"
            >
              <TrendingProjectCard
                project={project}
                userInfo={userInfo}
                handleLike={handleLike}
                isDarkMode={isDarkMode}
                showTrendingBadge={true}
              />
            </motion.div>
          ))}
          <motion.div
            variants={cardVariants}
            className="scroll-item w-48 flex-shrink-0 items-center"
          >
            <Link
              href="/projects"
              className="flex items-center justify-center w-full h-full text-center"
            >
              <span
                className={`${isDarkMode ? 'text-purple-300' : 'text-indigo-600'} font-semibold inline-block transition-transform duration-150 hover:-translate-y-0.5 hover:${isDarkMode ? 'text-purple-200' : 'text-indigo-700'}`}
              >
                See more →
              </span>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="mb-16"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className={`text-3xl font-bold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            ⭐ Best of All Time
          </h2>
          <div
            className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {bestOfAllTime.length} projects
          </div>
        </div>

        <div className="scroll-container">
          {bestOfAllTime.map(project => (
            <motion.div
              key={project.id}
              variants={cardVariants}
              className="scroll-item w-80 flex-shrink-0"
            >
              <TrendingProjectCard
                project={project}
                userInfo={userInfo}
                handleLike={handleLike}
                isDarkMode={isDarkMode}
                showTrendingBadge={false}
              />
            </motion.div>
          ))}
          <motion.div
            variants={cardVariants}
            className="scroll-item w-48 flex-shrink-0 items-center"
          >
            <Link
              href="/projects"
              className="flex items-center justify-center w-full h-full text-center"
            >
              <span
                className={`${isDarkMode ? 'text-purple-300' : 'text-indigo-600'} font-semibold inline-block transition-transform duration-150 hover:-translate-y-0.5 hover:${isDarkMode ? 'text-purple-200' : 'text-indigo-700'}`}
              >
                See more →
              </span>
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
