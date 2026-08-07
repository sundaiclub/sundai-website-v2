'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import type { PublicEventDetail } from '@/types/event-management';
import EventMarkdown from './EventMarkdown';
import { useManagementClasses } from './ManagementSurface';

function formatEventDate(
  startTime: PublicEventDetail['startTime'],
  endTime: PublicEventDetail['endTime'],
  timezone: string
) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  if (!end) return `${date.format(start)} at ${time.format(start)}`;
  if (date.format(start) === date.format(end)) {
    return `${date.format(start)} · ${time.format(start)}–${time.format(end)}`;
  }
  return `${date.format(start)}, ${time.format(start)} – ${date.format(end)}, ${time.format(end)}`;
}

export function PublicEventHero({
  event,
  actions,
}: {
  event: PublicEventDetail;
  actions?: ReactNode;
}) {
  const classes = useManagementClasses();
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';
  const iconClassName = `mt-0.5 h-5 w-5 shrink-0 ${classes.mutedText}`;

  return (
    <article className={`${classes.panel} overflow-hidden`}>
      <div
        className={`${classes.subtlePanel} relative aspect-[16/7] w-full overflow-hidden rounded-none border-0 border-b`}
      >
        <Image
          alt={event.image?.alt || `${event.title} event`}
          className={
            event.image?.url ? 'object-cover' : 'object-contain p-10 sm:p-16'
          }
          fill
          priority
          sizes="(min-width: 1280px) 1152px, 100vw"
          src={event.image?.url || placeholderLogo}
          unoptimized={Boolean(event.image?.url)}
        />
        {event.image?.url && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        )}
      </div>

      <div className="p-5 sm:p-7 lg:p-8">
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] ${classes.mutedText}`}
        >
          {event.chapterName}
        </p>
        <h1 className="mt-3 max-w-4xl text-balance text-3xl font-bold leading-tight sm:text-5xl">
          {event.title}
        </h1>
        {event.description && (
          <EventMarkdown
            className={`prose mt-4 max-w-3xl text-base leading-7 prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-a:text-current prose-li:my-0 ${
              classes.isDarkMode ? 'prose-invert' : 'prose-gray'
            } ${classes.mutedText}`}
            markdown={event.description}
          />
        )}

        <dl
          className={`mt-6 grid gap-4 border-t pt-5 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'} sm:grid-cols-2`}
        >
          <div className="flex gap-3">
            <svg
              aria-hidden="true"
              className={iconClassName}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5m-15 12h13.5a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5V19.5a1.5 1.5 0 0 0 1.5 1.5Z"
              />
            </svg>
            <div>
              <dt
                className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                When
              </dt>
              <dd className="mt-1 text-base font-semibold leading-7">
                {formatEventDate(
                  event.startTime,
                  event.endTime,
                  event.timezone
                )}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <svg
              aria-hidden="true"
              className={iconClassName}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s6.75-5.4 6.75-12A6.75 6.75 0 1 0 5.25 9C5.25 15.6 12 21 12 21Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <div>
              <dt
                className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                Where
              </dt>
              <dd className="mt-1 text-base font-semibold leading-7">
                {event.publicLocation || 'Location to be announced'}
              </dd>
            </div>
          </div>
        </dl>

        {actions && (
          <div
            className={`mt-5 flex flex-wrap items-center gap-2 border-t pt-5 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
          >
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}
