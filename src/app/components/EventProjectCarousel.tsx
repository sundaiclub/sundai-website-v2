'use client';

import { useUser } from '@clerk/nextjs';
import { useRef, useState } from 'react';
import type { PublicEventProject } from '@/types/event-management';
import { useUserContext } from '@/app/contexts/UserContext';
import { useTheme } from '@/app/contexts/ThemeContext';
import { ProjectCard } from './Project';
import {
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

export function EventProjectCarousel({
  projects,
}: {
  projects: PublicEventProject[];
}) {
  const classes = useManagementClasses();
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { userInfo } = useUserContext();
  const [eventProjects, setEventProjects] = useState(projects);
  const listRef = useRef<HTMLOListElement>(null);

  function move(direction: -1 | 1) {
    listRef.current?.scrollBy({
      left: direction * Math.min(listRef.current.clientWidth * 0.85, 420),
      behavior: 'smooth',
    });
  }

  async function handleLike(
    event: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) {
    event.preventDefault();
    if (!user) {
      alert('Please sign in to like projects');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });
      if (!response.ok) return;

      setEventProjects(currentProjects =>
        currentProjects.map(project =>
          project.id === projectId
            ? {
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
              }
            : project
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <ManagementSection
        title="Projects from this event"
        description="Explore every project, ordered by the number of likes it received during the pitch vote."
        actions={
          projects.length > 1 ? (
            <div className="flex gap-2">
              <button
                aria-label="Show previous event projects"
                className={classes.secondaryButton}
                onClick={() => move(-1)}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                aria-label="Show next event projects"
                className={classes.secondaryButton}
                onClick={() => move(1)}
                type="button"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : null
        }
        size="large"
      >
        {eventProjects.length === 0 ? (
          <ManagementEmptyState>
            No projects have been added to this event.
          </ManagementEmptyState>
        ) : (
          <ol
            aria-label="Event projects ranked by pitch votes"
            className="flex min-w-0 max-w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3"
            ref={listRef}
          >
            {eventProjects.map((project, index) => (
              <li
                className="w-[85%] min-w-0 shrink-0 snap-start sm:w-80"
                key={project.id}
              >
                <ProjectCard
                  project={project}
                  userInfo={userInfo}
                  handleLike={handleLike}
                  isDarkMode={isDarkMode}
                  show_status={false}
                  show_team={true}
                  variant="trending"
                  imageBadge={`#${index + 1} · ${project.pitchVoteCount} ${project.pitchVoteCount === 1 ? 'vote' : 'votes'}`}
                />
              </li>
            ))}
          </ol>
        )}
      </ManagementSection>
    </div>
  );
}
