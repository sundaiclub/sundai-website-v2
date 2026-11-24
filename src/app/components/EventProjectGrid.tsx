'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import type { PublicEventProject } from '@/types/event-management';
import { useUserContext } from '@/app/contexts/UserContext';
import { useTheme } from '@/app/contexts/ThemeContext';
import { ProjectCard } from './Project';
import { ManagementEmptyState, ManagementSection } from './ManagementSurface';

export function EventProjectGrid({
  projects,
}: {
  projects: PublicEventProject[];
}) {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { userInfo } = useUserContext();
  const [eventProjects, setEventProjects] = useState(projects);

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
    <div className="min-w-0 max-w-full">
      <ManagementSection
        title="Projects from this event"
        description="Explore every project, ordered by the number of likes it received during the pitch vote."
        size="large"
      >
        {eventProjects.length === 0 ? (
          <ManagementEmptyState>
            No projects have been added to this event.
          </ManagementEmptyState>
        ) : (
          <ol
            aria-label="Event projects ranked by pitch votes"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {eventProjects.map((project, index) => (
              <li className="min-w-0" key={project.id}>
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
