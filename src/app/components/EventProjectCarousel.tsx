'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import type { PublicEventProject } from '@/types/event-management';
import { ManagementSection, useManagementClasses } from './ManagementSurface';

export function EventProjectCarousel({
  projects,
}: {
  projects: PublicEventProject[];
}) {
  const classes = useManagementClasses();
  const listRef = useRef<HTMLOListElement>(null);

  if (projects.length === 0) return null;

  function move(direction: -1 | 1) {
    listRef.current?.scrollBy({
      left: direction * Math.min(listRef.current.clientWidth * 0.85, 420),
      behavior: 'smooth',
    });
  }

  return (
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
      <ol
        aria-label="Event projects ranked by pitch votes"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
        ref={listRef}
      >
        {projects.map((project, index) => (
          <li
            className={`${classes.subtlePanel} w-[85%] shrink-0 snap-start overflow-hidden sm:w-[22rem] lg:w-[24rem]`}
            key={project.id}
          >
            <Link
              className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
              href={`/projects/${project.id}`}
            >
              <div
                className={`relative aspect-[16/9] overflow-hidden border-b ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
              >
                <Image
                  alt={project.thumbnail?.alt || project.title}
                  className={
                    project.thumbnail?.url
                      ? 'object-cover'
                      : 'object-contain p-8'
                  }
                  fill
                  sizes="(min-width: 1024px) 384px, (min-width: 640px) 352px, 85vw"
                  src={
                    project.thumbnail?.url ||
                    (classes.isDarkMode
                      ? '/images/default_project_thumbnail_dark.svg'
                      : '/images/default_project_thumbnail_light.svg')
                  }
                  unoptimized={Boolean(project.thumbnail?.url)}
                />
                <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-sm font-bold text-white">
                  #{index + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold leading-7 group-hover:underline">
                    {project.title}
                  </h3>
                  <span className="shrink-0 rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-sm font-semibold text-emerald-200">
                    {project.pitchVoteCount}{' '}
                    {project.pitchVoteCount === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
                {project.preview && (
                  <p
                    className={`mt-3 line-clamp-2 text-base leading-7 ${classes.mutedText}`}
                  >
                    {project.preview}
                  </p>
                )}
                <p
                  className={`mt-auto pt-4 text-sm font-semibold ${classes.mutedText}`}
                >
                  Led by {project.launchLeadName}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </ManagementSection>
  );
}
