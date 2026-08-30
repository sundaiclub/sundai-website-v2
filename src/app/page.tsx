'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import TrendingSections from './components/TrendingSections';
import YourEventsSection from './components/YourEventsSection';
import HomepageIntro from './components/HomepageIntro';
import { useState, useEffect } from 'react';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { useTheme } from './contexts/ThemeContext';
import { useUser } from '@clerk/nextjs';
import { useUserContext } from './contexts/UserContext';
import type { Project } from '@/types/project';
import type {
  CurrentUserEvent,
  PublicEventCard,
} from '@/types/event-management';

function getEndOfCurrentWeek(now: Date) {
  const endOfWeek = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7;
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<PublicEventCard[]>([]);
  const [currentEvents, setCurrentEvents] = useState<CurrentUserEvent[]>([]);
  const [currentEventsLoading, setCurrentEventsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();
  const { user, isLoaded = true } = useUser();
  const { userInfo } = useUserContext();

  usePullToRefresh();

  useEffect(() => {
    async function fetchHomepageContent() {
      const [projectsResult, eventsResult] = await Promise.allSettled([
        fetch('/api/projects?status=APPROVED').then(async response => {
          if (!response.ok)
            throw new Error(`Projects request failed with ${response.status}`);
          return response.json() as Promise<Project[]>;
        }),
        fetch('/api/events').then(async response => {
          if (!response.ok)
            throw new Error(`Events request failed with ${response.status}`);
          return response.json() as Promise<PublicEventCard[]>;
        }),
      ]);

      if (
        projectsResult.status === 'fulfilled' &&
        Array.isArray(projectsResult.value)
      ) {
        setProjects(projectsResult.value);
      } else {
        console.error(
          'Error fetching projects:',
          projectsResult.status === 'rejected'
            ? projectsResult.reason
            : 'Unexpected response'
        );
      }

      if (
        eventsResult.status === 'fulfilled' &&
        Array.isArray(eventsResult.value)
      ) {
        const endOfWeek = getEndOfCurrentWeek(new Date());
        setEvents(
          eventsResult.value.filter(event => {
            const startTime = new Date(event.startTime);
            return !Number.isNaN(startTime.getTime()) && startTime <= endOfWeek;
          })
        );
      } else {
        console.error(
          'Error fetching events:',
          eventsResult.status === 'rejected'
            ? eventsResult.reason
            : 'Unexpected response'
        );
      }

      setLoading(false);
    }

    fetchHomepageContent();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setCurrentEvents([]);
      setCurrentEventsLoading(false);
      return;
    }

    let cancelled = false;
    setCurrentEventsLoading(true);

    fetch('/api/events/mine')
      .then(async response => {
        if (!response.ok) {
          throw new Error(`User events request failed with ${response.status}`);
        }
        return response.json() as Promise<CurrentUserEvent[]>;
      })
      .then(result => {
        if (!cancelled && Array.isArray(result)) setCurrentEvents(result);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Error fetching user events:', error);
          setCurrentEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCurrentEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id]);

  const handleLike = async (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to like projects');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        setProjects(
          projects.map(project => {
            if (project.id === projectId) {
              return {
                ...project,
                likes: isLiked
                  ? project.likes.filter(like => like.hackerId !== userInfo?.id)
                  : [
                      ...project.likes,
                      {
                        hackerId: userInfo?.id || '',
                        createdAt: new Date().toISOString(),
                      },
                    ],
              };
            }
            return project;
          })
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? 'bg-gradient-to-b from-gray-900 to-black text-gray-100'
          : 'bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800'
      } font-space-mono`}
    >
      <main className="overflow-hidden pb-16">
        {!isLoaded || currentEventsLoading ? (
          <YourEventsSection
            events={[]}
            isDarkMode={isDarkMode}
            isSignedIn={Boolean(user)}
            isLoading={true}
          />
        ) : currentEvents.length > 0 ? (
          <YourEventsSection
            events={currentEvents}
            isDarkMode={isDarkMode}
            isSignedIn={true}
            isLoading={false}
          />
        ) : (
          <HomepageIntro isDarkMode={isDarkMode} />
        )}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div
              className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
                isDarkMode ? 'border-purple-400' : 'border-indigo-600'
              }`}
            ></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
          >
            <TrendingSections
              events={events}
              projects={projects}
              userInfo={userInfo}
              handleLike={handleLike}
              isDarkMode={isDarkMode}
            />
          </motion.div>
        )}
      </main>
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className={`${
          isDarkMode
            ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-gray-200'
            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
        } py-6 md:py-2`}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Copyright notice - Left aligned */}
            <p className="text-sm md:text-base order-2 md:order-1 mt-4 md:mt-0">
              &copy; 2025 Sundai Club. All rights reserved.
            </p>

            {/* Foundation link - Center aligned */}
            <p className="text-sm md:text-base order-1 md:order-2 mb-4 md:mb-0">
              <a
                href="https://sundai.foundation"
                target="_blank"
                rel="noopener noreferrer"
                className={`${
                  isDarkMode
                    ? 'text-gray-200 hover:text-indigo-400'
                    : 'text-gray-700 hover:text-indigo-600'
                } transition duration-300`}
              >
                More about Sundai
              </a>
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <Link
                href="/privacy"
                className={`${
                  isDarkMode
                    ? 'text-gray-200 hover:text-indigo-400'
                    : 'text-gray-700 hover:text-indigo-600'
                } transition duration-300`}
              >
                Privacy
              </Link>
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <Link
                href="/terms"
                className={`${
                  isDarkMode
                    ? 'text-gray-200 hover:text-indigo-400'
                    : 'text-gray-700 hover:text-indigo-600'
                } transition duration-300`}
              >
                Terms
              </Link>
            </p>

            {/* Social links - Right aligned */}
            <ul className="flex justify-center order-1 md:order-2">
              {/* GitHub */}
              <li>
                <Link
                  href="https://github.com/sundai-club"
                  className={`flex justify-center items-center w-8 h-8 ${
                    isDarkMode
                      ? 'text-gray-200 hover:text-purple-400'
                      : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`}
                  aria-label="Github"
                >
                  <svg
                    className="w-6 h-6 fill-current"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M16 8.2c-4.4 0-8 3.6-8 8 0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4V22c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.7 3.9.3.4.6.9.6 1.6v2.2c0 .2.1.5.6.4 3.2-1.1 5.5-4.1 5.5-7.6-.1-4.4-3.7-8-8.1-8z" />
                  </svg>
                </Link>
              </li>
              {/* X (Twitter) */}
              <li className="ml-4">
                <Link
                  href="https://twitter.com/sundai_club"
                  className={`flex justify-center items-center w-8 h-8 ${
                    isDarkMode
                      ? 'text-gray-200 hover:text-purple-400'
                      : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`}
                  aria-label="Twitter"
                >
                  <svg
                    className="w-5 h-5 fill-current"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="m13.063 9 3.495 4.475L20.601 9h2.454l-5.359 5.931L24 23h-4.938l-3.866-4.893L10.771 23H8.316l5.735-6.342L8 9h5.063Zm-.74 1.347h-1.457l8.875 11.232h1.36l-8.778-11.232Z" />
                  </svg>
                </Link>
              </li>
              {/* LinkedIn */}
              <li className="ml-4">
                <Link
                  href="https://www.linkedin.com/company/sundaiclub"
                  className={`flex justify-center items-center w-8 h-8 ${
                    isDarkMode
                      ? 'text-gray-200 hover:text-purple-400'
                      : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`}
                  aria-label="LinkedIn"
                >
                  <svg
                    className="w-4 h-4 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 448 512"
                  >
                    <path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z" />
                  </svg>
                </Link>
              </li>
              {/* Instagram */}
              <li className="ml-4">
                <Link
                  href="https://instagram.com/sundai_club"
                  className={`flex justify-center items-center w-8 h-8 ${
                    isDarkMode
                      ? 'text-gray-200 hover:text-purple-400'
                      : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`}
                  aria-label="Instagram"
                >
                  <svg
                    className="w-4 h-4 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 448 512"
                  >
                    <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
                  </svg>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
